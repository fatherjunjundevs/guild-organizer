"use server";

import { revalidatePath } from "next/cache";
import {
  isValidEventUuid,
  parseEventCreationInput,
} from "@/features/events/event-management";
import { createClient } from "@/lib/supabase/server";

export type EventMutationResult =
  | { ok: true; message: string; id: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function eventsPath(guildId: string) {
  return `/app/guild/${guildId}/events`;
}

function mapEventRpcError(code: string | undefined) {
  if (code === "42501") {
    return "You do not have permission to create Events from that Template.";
  }

  if (code === "23514") {
    return "That Template is not currently active and ready for Event creation.";
  }

  if (code === "P0002") {
    return "The selected Template could not be found.";
  }

  if (code === "22023") {
    return "One or more Event fields are invalid.";
  }

  return "The Event could not be created. No partial Event was saved.";
}

export async function createEventAction(
  formData: FormData,
): Promise<EventMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!isValidEventUuid(guildId)) {
    return { ok: false, message: "The Guild identifier is invalid." };
  }

  const parsed = parseEventCreationInput({
    templateId: getString(formData, "templateId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
  });

  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data: template, error: templateError } = await supabase
    .from("event_templates")
    .select("id")
    .eq("id", parsed.value.templateId)
    .eq("guild_id", guildId)
    .eq("status", "active")
    .maybeSingle();

  if (templateError || !template) {
    return {
      ok: false,
      message: "The selected active Template is unavailable for this Guild.",
    };
  }

  const args: {
    p_template_id: string;
    p_name: string;
    p_description?: string;
  } = {
    p_template_id: parsed.value.templateId,
    p_name: parsed.value.name,
  };

  if (parsed.value.description !== null) {
    args.p_description = parsed.value.description;
  }

  const { data: eventId, error } = await supabase.rpc(
    "create_event_from_template",
    args,
  );

  if (error || !eventId) {
    return { ok: false, message: mapEventRpcError(error?.code) };
  }

  revalidatePath(eventsPath(guildId));
  revalidatePath(`/app/guild/${guildId}/dashboard`);

  return {
    ok: true,
    message: `${parsed.value.name} was created from an independent Template snapshot.`,
    id: eventId,
  };
}
