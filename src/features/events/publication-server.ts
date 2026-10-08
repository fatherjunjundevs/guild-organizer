import "server-only";

import type {
  EventPublicationState,
} from "@/features/events/event-publication";
import type { GuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";

export type EventPublicationAuthorization =
  | "allowed"
  | "forbidden"
  | "error";

export type EventPublicationLoadResult =
  | {
      status: "ready";
      publication: EventPublicationState;
    }
  | {
      status: "error";
      publication: null;
    };

export async function canPublishEvent(
  access: GuildAccess,
): Promise<EventPublicationAuthorization> {
  if (access.role === "owner" || access.role === "admin") {
    return "allowed";
  }

  if (access.role !== "officer") {
    return "forbidden";
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guild_officer_capabilities")
    .select("capability_key")
    .eq("guild_id", access.guildId)
    .eq("membership_id", access.membershipId)
    .eq("capability_key", "publish.manage")
    .maybeSingle();

  if (error) return "error";
  return data ? "allowed" : "forbidden";
}

export async function loadEventPublicationState(
  guildId: string,
  eventId: string,
): Promise<EventPublicationLoadResult> {
  const supabase = await createClient();
  const { data: publication, error: publicationError } =
    await supabase
      .from("event_publications")
      .select(
        "id,status,current_version_id,published_at,unpublished_at",
      )
      .eq("guild_id", guildId)
      .eq("event_id", eventId)
      .maybeSingle();

  if (publicationError) {
    return { status: "error", publication: null };
  }

  if (!publication) {
    return {
      status: "ready",
      publication: {
        lifecycle: "draft",
        currentVersionId: null,
        currentVersionNumber: null,
        latestVersionNumber: null,
        publishedAt: null,
        unpublishedAt: null,
      },
    };
  }

  const { data: versions, error: versionsError } = await supabase
    .from("event_publication_versions")
    .select("id,version_number")
    .eq("guild_id", guildId)
    .eq("event_id", eventId)
    .eq("publication_id", publication.id)
    .order("version_number", { ascending: false });

  if (versionsError) {
    return { status: "error", publication: null };
  }

  const latestVersion = versions?.[0] ?? null;
  const currentVersion = publication.current_version_id
    ? (versions ?? []).find(
        (version) => version.id === publication.current_version_id,
      ) ?? null
    : null;

  if (
    publication.status === "published" &&
    (!publication.current_version_id || !currentVersion)
  ) {
    return { status: "error", publication: null };
  }

  return {
    status: "ready",
    publication: {
      lifecycle:
        publication.status === "published"
          ? "published"
          : latestVersion
            ? "unpublished"
            : "draft",
      currentVersionId: publication.current_version_id,
      currentVersionNumber: currentVersion?.version_number ?? null,
      latestVersionNumber: latestVersion?.version_number ?? null,
      publishedAt: publication.published_at,
      unpublishedAt: publication.unpublished_at,
    },
  };
}
