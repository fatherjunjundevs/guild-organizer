"use server";

import { revalidatePath } from "next/cache";
import {
  parseRosterCustomFieldDefinition,
  parseRosterCustomFieldName,
  parseRosterCustomFieldValue,
  type RosterCustomFieldType,
  type RosterCustomFieldValue,
} from "@/features/roster/custom-fields";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RosterCustomFieldMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

function mapDefinitionError(code: string | undefined) {
  if (code === "23505") {
    return "A custom field with that name already exists.";
  }

  if (code === "23514") {
    return "A Choice option cannot be removed while a character still uses it. Change those character values first.";
  }

  if (code === "42501") {
    return "You do not have permission to manage roster custom fields.";
  }

  if (code === "P0002") {
    return "The roster custom field could not be found.";
  }

  if (code === "22023") {
    return "The custom field change is invalid or the Guild has reached its 20-field limit.";
  }

  return "The custom field change could not be saved.";
}

function mapValueError(code: string | undefined) {
  if (code === "42501") {
    return "You do not have permission to manage these character fields.";
  }

  if (code === "P0002") {
    return "The character or custom field could not be found.";
  }

  if (code === "22023") {
    return "One or more custom field values are invalid.";
  }

  return "The character custom fields could not be saved.";
}

export async function createRosterCustomFieldAction(
  formData: FormData,
): Promise<RosterCustomFieldMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!UUID_PATTERN.test(guildId)) {
    return { ok: false, message: "The Guild identifier is invalid." };
  }

  const parsedName = parseRosterCustomFieldName(
    getString(formData, "name"),
  );

  if (!parsedName.ok) {
    return parsedName;
  }

  const parsedDefinition = parseRosterCustomFieldDefinition(
    getString(formData, "fieldType"),
    getString(formData, "selectOptions"),
  );

  if (!parsedDefinition.ok) {
    return parsedDefinition;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_roster_custom_field", {
    p_guild_id: guildId,
    p_name: parsedName.value,
    p_field_type: parsedDefinition.value.fieldType,
    p_select_options: parsedDefinition.value.selectOptions,
  });

  if (error) {
    return { ok: false, message: mapDefinitionError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return {
    ok: true,
    message: `${parsedName.value} was created.`,
  };
}

export async function updateRosterCustomFieldAction(
  formData: FormData,
): Promise<RosterCustomFieldMutationResult> {
  const guildId = getString(formData, "guildId");
  const fieldId = getString(formData, "fieldId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(fieldId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const parsedName = parseRosterCustomFieldName(
    getString(formData, "name"),
  );

  if (!parsedName.ok) {
    return parsedName;
  }

  const parsedDefinition = parseRosterCustomFieldDefinition(
    getString(formData, "fieldType"),
    getString(formData, "selectOptions"),
  );

  if (!parsedDefinition.ok) {
    return parsedDefinition;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_roster_custom_field", {
    p_field_id: fieldId,
    p_name: parsedName.value,
    p_select_options: parsedDefinition.value.selectOptions,
  });

  if (error) {
    return { ok: false, message: mapDefinitionError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Custom field updated." };
}

export async function deleteRosterCustomFieldAction(
  formData: FormData,
): Promise<RosterCustomFieldMutationResult> {
  const guildId = getString(formData, "guildId");
  const fieldId = getString(formData, "fieldId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(fieldId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_roster_custom_field", {
    p_field_id: fieldId,
  });

  if (error) {
    return { ok: false, message: mapDefinitionError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Custom field deleted." };
}

export async function setCharacterRosterCustomFieldsAction(
  formData: FormData,
): Promise<RosterCustomFieldMutationResult> {
  const guildId = getString(formData, "guildId");
  const characterId = getString(formData, "characterId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(characterId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const supabase = await createClient();
  const { data: fields, error: fieldsError } = await supabase
    .from("roster_custom_fields")
    .select("id,name,field_type,select_options")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: true });

  if (fieldsError) {
    return {
      ok: false,
      message: "The Guild custom fields could not be loaded.",
    };
  }

  const values: Array<{
    field_id: string;
    value: RosterCustomFieldValue;
  }> = [];

  for (const field of fields ?? []) {
    const definition = {
      fieldType: field.field_type as RosterCustomFieldType,
      selectOptions: field.select_options,
    };
    const parsedValue = parseRosterCustomFieldValue(
      definition,
      formData.get(`customField:${field.id}`),
    );

    if (!parsedValue.ok) {
      return {
        ok: false,
        message: `${field.name}: ${parsedValue.message}`,
      };
    }

    if (parsedValue.value !== null) {
      values.push({
        field_id: field.id,
        value: parsedValue.value,
      });
    }
  }

  const { error } = await supabase.rpc(
    "set_character_roster_custom_fields",
    {
      p_character_id: characterId,
      p_values: values as Json,
    },
  );

  if (error) {
    return { ok: false, message: mapValueError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Character custom fields saved." };
}
