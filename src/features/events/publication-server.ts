import "server-only";

import type {
  EventBuilderCharacter,
} from "@/features/events/event-assignment";
import { buildEventBuilderStructure } from "@/features/events/event-builder";
import type {
  EventPublicationState,
  EventPublicationHistoryPage,
  EventPublicationVersionSnapshot,
  EventPublicationVersionSummary,
} from "@/features/events/event-publication";
import {
  sortEventPublicationHistory,
} from "@/features/events/event-publication";
import type { GuildAccess } from "@/features/guilds/server";
import { createClient } from "@/lib/supabase/server";
import {
  PUBLICATION_HISTORY_PAGE_SIZE,
  readCompletePublicationRows,
} from "@/features/events/publication-pagination";

export type EventPublicationAuthorization =
  | "allowed"
  | "forbidden"
  | "error";

export type EventPublicationLoadResult =
  | {
      status: "ready";
      publication: EventPublicationState;
      historyCount: number;
    }
  | {
      status: "error";
      publication: null;
      historyCount: 0;
    };

export type EventPublicationSnapshotLoadResult =
  | {
      status: "ready";
      snapshot: EventPublicationVersionSnapshot;
    }
  | {
      status: "not-found" | "error";
      snapshot: null;
    };

function emptyPublication(): EventPublicationState {
  return {
    lifecycle: "draft",
    currentVersionId: null,
    currentVersionNumber: null,
    latestVersionNumber: null,
    publishedAt: null,
    unpublishedAt: null,
  };
}

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
    return {
      status: "error",
      publication: null,
      historyCount: 0,
    };
  }

  if (!publication) {
    return {
      status: "ready",
      publication: emptyPublication(),
      historyCount: 0,
    };
  }

  const [latestResult, currentResult] = await Promise.all([
    supabase.from("event_publication_versions")
      .select("id,version_number", { count: "exact" })
      .eq("guild_id", guildId).eq("event_id", eventId)
      .eq("publication_id", publication.id).not("sealed_at", "is", null)
      .order("version_number", { ascending: false }).limit(1),
    publication.current_version_id
      ? supabase.from("event_publication_versions").select("id,version_number")
          .eq("guild_id", guildId).eq("event_id", eventId)
          .eq("publication_id", publication.id)
          .eq("id", publication.current_version_id).not("sealed_at", "is", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (latestResult.error || currentResult.error || latestResult.count === null ||
      latestResult.data?.length !== Math.min(1, latestResult.count)) {
    return { status: "error", publication: null, historyCount: 0 };
  }
  const latestVersion = latestResult.data?.[0] ?? null;
  const currentVersion = currentResult.data;

  if (
    publication.status === "published" &&
    (!publication.current_version_id || !currentVersion)
  ) {
    return {
      status: "error",
      publication: null,
      historyCount: 0,
    };
  }

  return {
    status: "ready",
    historyCount: latestResult.count,
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

export async function loadEventPublicationVersionSnapshot(
  guildId: string,
  eventId: string,
  versionId: string,
): Promise<EventPublicationSnapshotLoadResult> {
  const supabase = await createClient();
  const { data: version, error: versionError } = await supabase
    .from("event_publication_versions")
    .select(
      "id,publication_id,version_number,event_name_snapshot,event_description_snapshot,event_type_name_snapshot,template_name_snapshot,uses_areas,created_at,sealed_at",
    )
    .eq("guild_id", guildId)
    .eq("event_id", eventId)
    .eq("id", versionId)
    .not("sealed_at", "is", null)
    .maybeSingle();

  if (versionError) {
    return { status: "error", snapshot: null };
  }

  if (!version || !version.sealed_at) {
    return { status: "not-found", snapshot: null };
  }

  // Sealed children use session RLS, explicit scope, exact counts and stable
  // ordering. A missing batch fails the entire snapshot instead of showing gaps.
  let snapshotRows;
  try {
    snapshotRows = await Promise.all([
      supabase.from("event_publications").select("current_version_id")
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("id", version.publication_id).maybeSingle(),
      readCompletePublicationRows((from, to) => supabase
        .from("event_publication_areas").select("id,name,sort_order", { count: "exact" })
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("publication_version_id", versionId).order("id").range(from, to)),
      readCompletePublicationRows((from, to) => supabase
        .from("event_publication_sections").select("id,area_id,name,sort_order", { count: "exact" })
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("publication_version_id", versionId).order("id").range(from, to)),
      readCompletePublicationRows((from, to) => supabase
        .from("event_publication_parties").select("id,section_id,name,sort_order", { count: "exact" })
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("publication_version_id", versionId).order("id").range(from, to)),
      readCompletePublicationRows((from, to) => supabase
        .from("event_publication_slots").select("id,party_id,name,role_label,sort_order", { count: "exact" })
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("publication_version_id", versionId).order("id").range(from, to)),
      readCompletePublicationRows((from, to) => supabase
        .from("event_publication_assignments")
        .select("id,slot_id,source_character_id,character_ign_snapshot,character_class_snapshot,character_role_snapshot,character_designation_snapshot,character_status_snapshot", { count: "exact" })
        .eq("guild_id", guildId).eq("event_id", eventId)
        .eq("publication_version_id", versionId).order("id").range(from, to)),
    ]);
  } catch {
    return { status: "error", snapshot: null };
  }
  const [publicationResult, areas, sections, parties, slots, assignments] = snapshotRows;
  // Deletion or capability revocation during the read must fail closed.
  const visible = await supabase.from("event_publication_versions").select("id")
    .eq("guild_id", guildId).eq("event_id", eventId).eq("id", versionId)
    .not("sealed_at", "is", null).maybeSingle();
  if (publicationResult.error || !publicationResult.data || visible.error || !visible.data) {
    return { status: "error", snapshot: null };
  }

  const structure = buildEventBuilderStructure({
    usesAreas: version.uses_areas,
    areas,
    sections,
    parties,
    slots,
  });

  const charactersById = new Map<string, EventBuilderCharacter>();

  for (const assignment of assignments) {
    const existing = charactersById.get(
      assignment.source_character_id,
    );

    if (existing) {
      existing.assignedSlotIds.push(assignment.slot_id);
      continue;
    }

    charactersById.set(assignment.source_character_id, {
      id: assignment.source_character_id,
      ign: assignment.character_ign_snapshot,
      level: null,
      className: assignment.character_class_snapshot,
      guildPosition: null,
      gearScore: null,
      onlineStatus: null,
      designation: assignment.character_designation_snapshot,
      roleLabel: assignment.character_role_snapshot,
      status: assignment.character_status_snapshot as
        | "active"
        | "inactive",
      assignedSlotIds: [assignment.slot_id],
    });
  }

  const characters = [...charactersById.values()].sort(
    (left, right) =>
      left.ign.localeCompare(right.ign, undefined, {
        sensitivity: "base",
      }),
  );

  return {
    status: "ready",
    snapshot: {
      version: {
        id: version.id,
        versionNumber: version.version_number,
        eventName: version.event_name_snapshot,
        eventTypeName: version.event_type_name_snapshot,
        templateName: version.template_name_snapshot,
        usesAreas: version.uses_areas,
        createdAt: version.created_at,
        sealedAt: version.sealed_at,
        slotCount: slots.length,
        assignmentCount: assignments.length,
        isCurrent:
          publicationResult.data?.current_version_id === version.id,
      },
      description: version.event_description_snapshot,
      structure,
      characters,
    },
  };
}

export async function loadEventPublicationHistoryPage(
  guildId: string,
  eventId: string,
  beforeVersion: number | null = null,
  maxVersion: number | null = null,
): Promise<EventPublicationHistoryPage | null> {
  const state = await loadEventPublicationState(guildId, eventId);
  if (state.status !== "ready") return null;
  const maxVersionNumber = maxVersion ?? state.publication.latestVersionNumber ?? 0;
  const supabase = await createClient();
  let query = supabase.from("event_publication_versions")
    .select("id,version_number,event_name_snapshot,event_type_name_snapshot,template_name_snapshot,uses_areas,created_at,sealed_at", { count: "exact" })
    .eq("guild_id", guildId).eq("event_id", eventId)
    .not("sealed_at", "is", null).lte("version_number", maxVersionNumber)
    .order("version_number", { ascending: false }).limit(PUBLICATION_HISTORY_PAGE_SIZE);
  if (beforeVersion !== null) query = query.lt("version_number", beforeVersion);
  const [result, total] = await Promise.all([
    query,
    supabase.from("event_publication_versions").select("id", { count: "exact", head: true })
      .eq("guild_id", guildId).eq("event_id", eventId)
      .not("sealed_at", "is", null).lte("version_number", maxVersionNumber),
  ]);
  if (result.error || total.error || result.count === null || total.count === null || !result.data ||
      result.data.length !== Math.min(PUBLICATION_HISTORY_PAGE_SIZE, result.count)) return null;

  // Bounded exact HEAD counts keep the existing schema/RLS intact, without
  // downloading seats or assignments from all historical versions.
  const versions = await Promise.all(result.data.map(async (version): Promise<EventPublicationVersionSummary | null> => {
    const [slots, assignments] = await Promise.all([
      supabase.from("event_publication_slots").select("id", { count: "exact", head: true })
        .eq("guild_id", guildId).eq("event_id", eventId).eq("publication_version_id", version.id),
      supabase.from("event_publication_assignments").select("id", { count: "exact", head: true })
        .eq("guild_id", guildId).eq("event_id", eventId).eq("publication_version_id", version.id),
    ]);
    if (slots.error || assignments.error || slots.count === null || assignments.count === null || !version.sealed_at) return null;
    return {
      id: version.id, versionNumber: version.version_number,
      eventName: version.event_name_snapshot, eventTypeName: version.event_type_name_snapshot,
      templateName: version.template_name_snapshot, usesAreas: version.uses_areas,
      createdAt: version.created_at, sealedAt: version.sealed_at,
      slotCount: slots.count, assignmentCount: assignments.count,
      isCurrent: version.id === state.publication.currentVersionId,
    };
  }));
  if (versions.some((version) => version === null)) return null;
  // Recheck session visibility after counts rather than accepting zero counts
  // if membership was revoked during the request.
  const visibility = await supabase.from("events").select("id")
    .eq("guild_id", guildId).eq("id", eventId).maybeSingle();
  if (visibility.error || !visibility.data) return null;
  const summaries = sortEventPublicationHistory(versions.filter((version) => version !== null));
  return {
    versions: summaries, totalVersions: total.count, maxVersionNumber,
    nextBeforeVersion: result.count > summaries.length
      ? summaries.at(-1)?.versionNumber ?? null : null,
  };
}
