"use server";

import { isValidEventUuid } from "@/features/events/event-management";
import type { EventPublicationState } from "@/features/events/event-publication";
import { loadEventPublicationState } from "@/features/events/publication-server";
import { createClient } from "@/lib/supabase/server";

export type EventPublicationMutationResult =
  | {
      ok: true;
      message: string;
      publication: EventPublicationState | null;
    }
  | {
      ok: false;
      message: string;
    };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function mapPublicationRpcError(
  code: string | undefined,
  operation: "publish" | "update" | "unpublish",
) {
  if (code === "42501") {
    return "Publishing access is not enabled for your account.";
  }

  if (code === "P0002") {
    return "The Event or publication is no longer available.";
  }

  if (code === "23514") {
    return "The publication snapshot could not be activated safely.";
  }

  if (code === "55000") {
    if (operation === "publish") {
      return "This Event cannot be published in its current state. It may already be published or archived.";
    }

    if (operation === "update") {
      return "This publication cannot be updated in its current state. It may have been unpublished or the Event archived.";
    }

    return "This Event is not currently published.";
  }

  return "The publication change could not be saved.";
}

async function loadSavedPublication(
  guildId: string,
  eventId: string,
) {
  const result = await loadEventPublicationState(guildId, eventId);
  return result.status === "ready" ? result.publication : null;
}

async function eventMatchesGuild(
  guildId: string,
  eventId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("guild_id", guildId)
    .eq("id", eventId)
    .maybeSingle();

  return {
    supabase,
    matches: !error && Boolean(data),
  };
}

export async function publishEventAction(
  formData: FormData,
): Promise<EventPublicationMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");

  if (!isValidEventUuid(guildId) || !isValidEventUuid(eventId)) {
    return {
      ok: false,
      message: "The publication identifiers are invalid.",
    };
  }

  const context = await eventMatchesGuild(guildId, eventId);

  if (!context.matches) {
    return {
      ok: false,
      message: "This Event is unavailable for the selected Guild.",
    };
  }

  const { error } = await context.supabase.rpc("publish_event", {
    p_event_id: eventId,
  });

  if (error) {
    return {
      ok: false,
      message: mapPublicationRpcError(error.code, "publish"),
    };
  }

  const publication = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message: publication?.currentVersionNumber
      ? `Published version ${publication.currentVersionNumber}.`
      : "The Event was published. Refresh to load its version status.",
    publication,
  };
}

export async function updateEventPublicationAction(
  formData: FormData,
): Promise<EventPublicationMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");

  if (!isValidEventUuid(guildId) || !isValidEventUuid(eventId)) {
    return {
      ok: false,
      message: "The publication identifiers are invalid.",
    };
  }

  const context = await eventMatchesGuild(guildId, eventId);

  if (!context.matches) {
    return {
      ok: false,
      message: "This Event is unavailable for the selected Guild.",
    };
  }

  const { error } = await context.supabase.rpc(
    "update_event_publication",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    return {
      ok: false,
      message: mapPublicationRpcError(error.code, "update"),
    };
  }

  const publication = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message: publication?.currentVersionNumber
      ? `Published update as version ${publication.currentVersionNumber}.`
      : "The publication was updated. Refresh to load its version status.",
    publication,
  };
}

export async function unpublishEventAction(
  formData: FormData,
): Promise<EventPublicationMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");

  if (!isValidEventUuid(guildId) || !isValidEventUuid(eventId)) {
    return {
      ok: false,
      message: "The publication identifiers are invalid.",
    };
  }

  const context = await eventMatchesGuild(guildId, eventId);

  if (!context.matches) {
    return {
      ok: false,
      message: "This Event is unavailable for the selected Guild.",
    };
  }

  const { error } = await context.supabase.rpc("unpublish_event", {
    p_event_id: eventId,
  });

  if (error) {
    return {
      ok: false,
      message: mapPublicationRpcError(error.code, "unpublish"),
    };
  }

  const publication = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message:
      "Event unpublished. Immutable publication history was preserved.",
    publication,
  };
}
