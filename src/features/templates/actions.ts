"use server";

import { revalidatePath } from "next/cache";
import {
  isValidUuid,
  parseEventTypeManagementInput,
  parseTemplateManagementInput,
} from "@/features/templates/template-management";
import { createClient } from "@/lib/supabase/server";

export type TemplateMutationResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function templatesPath(guildId: string) {
  return `/app/guild/${guildId}/templates`;
}

function mapTemplateRpcError(code: string | undefined) {
  if (code === "23505") {
    return "That name is already in use in this Template scope.";
  }

  if (code === "42501") {
    return "You do not have permission for this change, or the selected Event Type is unavailable.";
  }

  if (code === "55000") {
    return "This lifecycle change is blocked. Archive dependent Templates first, or restore the required Event Type.";
  }

  if (code === "23514") {
    return "The Template structure mode cannot change after structure has been added.";
  }

  if (code === "P0002") {
    return "The Event Type or Template could not be found.";
  }

  if (code === "22023") {
    return "One or more Template fields are invalid.";
  }

  return "The Template change could not be saved.";
}

const nullableText = (value: string | null) =>
  value as unknown as string;

export async function createEventTypeAction(
  formData: FormData,
): Promise<TemplateMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!isValidUuid(guildId)) {
    return { ok: false, message: "The Guild identifier is invalid." };
  }

  const parsed = parseEventTypeManagementInput({
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    status: "active",
  });

  if (!parsed.ok) return parsed;

  const args: {
    p_guild_id: string;
    p_name: string;
    p_description?: string;
  } = {
    p_guild_id: guildId,
    p_name: parsed.value.name,
  };

  if (parsed.value.description !== null) {
    args.p_description = parsed.value.description;
  }

  const supabase = await createClient();
  const { data: eventTypeId, error } = await supabase.rpc(
    "create_event_type",
    args,
  );

  if (error || !eventTypeId) {
    return { ok: false, message: mapTemplateRpcError(error?.code) };
  }

  revalidatePath(templatesPath(guildId));

  return {
    ok: true,
    message: `${parsed.value.name} Event Type was created.`,
    id: eventTypeId,
  };
}

export async function updateEventTypeAction(
  formData: FormData,
): Promise<TemplateMutationResult> {
  const guildId = getString(formData, "guildId");
  const eventTypeId = getString(formData, "eventTypeId");

  if (!isValidUuid(guildId) || !isValidUuid(eventTypeId)) {
    return {
      ok: false,
      message: "The Event Type identifiers are invalid.",
    };
  }

  const parsed = parseEventTypeManagementInput({
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    status: getString(formData, "status"),
  });

  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event_type", {
    p_event_type_id: eventTypeId,
    p_name: parsed.value.name,
    p_description: nullableText(parsed.value.description),
    p_status: parsed.value.status,
  });

  if (error) {
    return { ok: false, message: mapTemplateRpcError(error.code) };
  }

  revalidatePath(templatesPath(guildId));

  return {
    ok: true,
    message: `${parsed.value.name} was updated.`,
    id: eventTypeId,
  };
}

export async function createEventTemplateAction(
  formData: FormData,
): Promise<TemplateMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!isValidUuid(guildId)) {
    return { ok: false, message: "The Guild identifier is invalid." };
  }

  const parsed = parseTemplateManagementInput({
    eventTypeId: getString(formData, "eventTypeId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    usesAreas: getString(formData, "usesAreas"),
    status: "draft",
  });

  if (!parsed.ok) return parsed;

  const args: {
    p_guild_id: string;
    p_event_type_id: string;
    p_name: string;
    p_description?: string;
    p_uses_areas: boolean;
  } = {
    p_guild_id: guildId,
    p_event_type_id: parsed.value.eventTypeId,
    p_name: parsed.value.name,
    p_uses_areas: parsed.value.usesAreas,
  };

  if (parsed.value.description !== null) {
    args.p_description = parsed.value.description;
  }

  const supabase = await createClient();
  const { data: templateId, error } = await supabase.rpc(
    "create_event_template",
    args,
  );

  if (error || !templateId) {
    return { ok: false, message: mapTemplateRpcError(error?.code) };
  }

  revalidatePath(templatesPath(guildId));

  return {
    ok: true,
    message: `${parsed.value.name} Template was created as a draft.`,
    id: templateId,
  };
}

export async function updateEventTemplateAction(
  formData: FormData,
): Promise<TemplateMutationResult> {
  const guildId = getString(formData, "guildId");
  const templateId = getString(formData, "templateId");

  if (!isValidUuid(guildId) || !isValidUuid(templateId)) {
    return {
      ok: false,
      message: "The Template identifiers are invalid.",
    };
  }

  const parsed = parseTemplateManagementInput({
    eventTypeId: getString(formData, "eventTypeId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    usesAreas: getString(formData, "usesAreas"),
    status: getString(formData, "status"),
  });

  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_event_template", {
    p_template_id: templateId,
    p_event_type_id: parsed.value.eventTypeId,
    p_name: parsed.value.name,
    p_description: nullableText(parsed.value.description),
    p_uses_areas: parsed.value.usesAreas,
    p_status: parsed.value.status,
  });

  if (error) {
    return { ok: false, message: mapTemplateRpcError(error.code) };
  }

  revalidatePath(templatesPath(guildId));

  return {
    ok: true,
    message:
      parsed.value.status === "archived"
        ? `${parsed.value.name} was archived.`
        : `${parsed.value.name} was saved as a draft.`,
    id: templateId,
  };
}
