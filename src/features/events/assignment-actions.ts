"use server";

import { revalidatePath } from "next/cache";
import { isValidEventUuid } from "@/features/events/event-management";
import { createClient } from "@/lib/supabase/server";

export type EventAssignmentMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function mapAssignmentRpcError(code: string | undefined) {
  if (code === "42501") {
    return "You do not have permission to change this Event.";
  }

  if (code === "23514") {
    return "Only active Guild Characters can receive new assignments.";
  }

  if (code === "55000") {
    return "Archived Events cannot change assignments.";
  }

  if (code === "P0002") {
    return "The selected Slot or Character is no longer available.";
  }

  if (code === "22023") {
    return "Choose two different Event Slots for drag-and-drop.";
  }

  return "The assignment could not be saved.";
}

function eventPath(guildId: string, eventId: string) {
  return `/app/guild/${guildId}/events/${eventId}`;
}

export async function assignEventSlotAction(
  formData: FormData,
): Promise<EventAssignmentMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  const slotId = getString(formData, "slotId");
  const characterId = getString(formData, "characterId");

  if (
    !isValidEventUuid(guildId) ||
    !isValidEventUuid(eventId) ||
    !isValidEventUuid(slotId) ||
    !isValidEventUuid(characterId)
  ) {
    return { ok: false, message: "The assignment identifiers are invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_event_slot", {
    p_slot_id: slotId,
    p_character_id: characterId,
  });

  if (error) {
    return { ok: false, message: mapAssignmentRpcError(error.code) };
  }

  revalidatePath(eventPath(guildId, eventId));
  revalidatePath(`/app/guild/${guildId}/events`);

  return { ok: true, message: "Character assigned." };
}

export async function moveEventSlotAssignmentAction(
  formData: FormData,
): Promise<EventAssignmentMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  const sourceSlotId = getString(formData, "sourceSlotId");
  const targetSlotId = getString(formData, "targetSlotId");

  if (
    !isValidEventUuid(guildId) ||
    !isValidEventUuid(eventId) ||
    !isValidEventUuid(sourceSlotId) ||
    !isValidEventUuid(targetSlotId)
  ) {
    return { ok: false, message: "The drag-and-drop identifiers are invalid." };
  }

  const supabase = await createClient();
  const { data: mode, error } = await supabase.rpc(
    "move_event_slot_assignment",
    {
      p_source_slot_id: sourceSlotId,
      p_target_slot_id: targetSlotId,
    },
  );

  if (error) {
    return { ok: false, message: mapAssignmentRpcError(error.code) };
  }

  // Drag/drop uses an optimistic local assignment update. Avoid route
  // revalidation here so the Event Builder does not remount immediately and
  // erase the fixed toast before its display duration completes.

  if (mode === "swapped") {
    return { ok: true, message: "Characters swapped." };
  }

  if (mode === "same_character") {
    return {
      ok: true,
      message: "That Character is already there.",
    };
  }

  return { ok: true, message: "Character moved." };
}

export async function clearEventSlotAction(
  formData: FormData,
): Promise<EventAssignmentMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventId = getString(formData, "eventId");
  const slotId = getString(formData, "slotId");

  if (
    !isValidEventUuid(guildId) ||
    !isValidEventUuid(eventId) ||
    !isValidEventUuid(slotId)
  ) {
    return { ok: false, message: "The assignment identifiers are invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_event_slot", {
    p_slot_id: slotId,
  });

  if (error) {
    return { ok: false, message: mapAssignmentRpcError(error.code) };
  }

  revalidatePath(eventPath(guildId, eventId));
  revalidatePath(`/app/guild/${guildId}/events`);

  return { ok: true, message: "Character removed." };
}
