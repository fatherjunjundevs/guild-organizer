"use server";

import { isValidEventUuid } from "@/features/events/event-management";
import type {
  EventPublicationState,
  EventPublicationVersionSnapshot,
  EventPublicationHistoryPage,
} from "@/features/events/event-publication";
import {
  loadEventPublicationState,
  loadEventPublicationHistoryPage,
  loadEventPublicationVersionSnapshot,
} from "@/features/events/publication-server";
import { createClient } from "@/lib/supabase/server";

export type EventPublicationMutationResult =
  | {
      ok: true;
      message: string;
      publication: EventPublicationState | null;
      historyCount: number | null;
    }
  | {
      ok: false;
      message: string;
    };

export type EventPublicationSnapshotResult =
  | {
      ok: true;
      snapshot: EventPublicationVersionSnapshot;
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
  try {
    const result = await loadEventPublicationState(guildId, eventId);
    return result.status === "ready"
      ? { publication: result.publication, historyCount: result.historyCount }
      : null;
  } catch {
    // The mutation has already committed. A read failure must never turn it
    // into a reported mutation failure or invite an automatic mutation retry.
    return null;
  }
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

  const saved = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message: saved?.publication.currentVersionNumber
      ? `Published version ${saved.publication.currentVersionNumber}.`
      : "The Event was published. Refresh to load its version status.",
    publication: saved?.publication ?? null,
    historyCount: saved?.historyCount ?? null,
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

  const saved = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message: saved?.publication.currentVersionNumber
      ? `Published update as version ${saved.publication.currentVersionNumber}.`
      : "The publication was updated. Refresh to load its version status.",
    publication: saved?.publication ?? null,
    historyCount: saved?.historyCount ?? null,
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

  const saved = await loadSavedPublication(guildId, eventId);

  return {
    ok: true,
    message:
      "Event unpublished. Immutable publication history was preserved.",
    publication: saved?.publication ?? null,
    historyCount: saved?.historyCount ?? null,
  };
}

export async function loadEventPublicationVersionAction(
  formData: FormData,
): Promise<EventPublicationSnapshotResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  const versionId = getString(formData, "versionId");

  if (
    !isValidEventUuid(guildId) ||
    !isValidEventUuid(eventId) ||
    !isValidEventUuid(versionId)
  ) {
    return {
      ok: false,
      message: "The publication history identifiers are invalid.",
    };
  }

  const context = await eventMatchesGuild(guildId, eventId);

  if (!context.matches) {
    return {
      ok: false,
      message: "This Event is unavailable for the selected Guild.",
    };
  }

  const result = await loadEventPublicationVersionSnapshot(
    guildId,
    eventId,
    versionId,
  );

  if (result.status === "not-found") {
    return {
      ok: false,
      message: "That immutable publication version is no longer available.",
    };
  }

  if (result.status === "error" || !result.snapshot) {
    return {
      ok: false,
      message: "The immutable publication snapshot could not be loaded.",
    };
  }

  return {
    ok: true,
    snapshot: result.snapshot,
  };
}

export async function refreshEventPublicationAction(formData: FormData) {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  if (!isValidEventUuid(guildId) || !isValidEventUuid(eventId)) return null;
  const context = await eventMatchesGuild(guildId, eventId);
  if (!context.matches) return null;
  return loadSavedPublication(guildId, eventId);
}

export async function loadEventPublicationHistoryAction(formData: FormData): Promise<
  { ok: true; page: EventPublicationHistoryPage } | { ok: false; message: string }
> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  const beforeText = getString(formData, "beforeVersion");
  const maxText = getString(formData, "maxVersion");
  const before = beforeText ? Number(beforeText) : null;
  const max = maxText ? Number(maxText) : null;
  if (!isValidEventUuid(guildId) || !isValidEventUuid(eventId) ||
      [before, max].some((value) => value !== null && (!Number.isSafeInteger(value) || value < 1 || value > 2147483647))) {
    return { ok: false, message: "The publication history identifiers are invalid." };
  }
  const context = await eventMatchesGuild(guildId, eventId);
  if (!context.matches) return { ok: false, message: "This Event is unavailable for the selected Guild." };
  const page = await loadEventPublicationHistoryPage(guildId, eventId, before, max);
  return page ? { ok: true, page } : { ok: false, message: "Publication history could not be loaded. Try again." };
}
