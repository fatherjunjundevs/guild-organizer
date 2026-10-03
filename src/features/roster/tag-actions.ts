"use server";

import { revalidatePath } from "next/cache";
import {
  parseRosterTagIds,
  parseRosterTagName,
} from "@/features/roster/roster-tags";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RosterTagMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function mapTagError(code: string | undefined) {
  if (code === "23505") {
    return "A roster tag with that name already exists.";
  }

  if (code === "42501") {
    return "You do not have permission to manage these roster tags.";
  }

  if (code === "P0002") {
    return "The roster tag or character could not be found.";
  }

  if (code === "22023") {
    return "The roster tag change is invalid.";
  }

  return "The roster tag change could not be saved.";
}

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

export async function createRosterTagAction(
  formData: FormData,
): Promise<RosterTagMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!UUID_PATTERN.test(guildId)) {
    return { ok: false, message: "The Guild identifier is invalid." };
  }

  const parsedName = parseRosterTagName(getString(formData, "name"));

  if (!parsedName.ok) {
    return parsedName;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_roster_tag", {
    p_guild_id: guildId,
    p_name: parsedName.value,
  });

  if (error) {
    return { ok: false, message: mapTagError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: `${parsedName.value} was created.` };
}

export async function renameRosterTagAction(
  formData: FormData,
): Promise<RosterTagMutationResult> {
  const guildId = getString(formData, "guildId");
  const tagId = getString(formData, "tagId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(tagId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const parsedName = parseRosterTagName(getString(formData, "name"));

  if (!parsedName.ok) {
    return parsedName;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_roster_tag", {
    p_tag_id: tagId,
    p_name: parsedName.value,
  });

  if (error) {
    return { ok: false, message: mapTagError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Roster tag renamed." };
}

export async function deleteRosterTagAction(
  formData: FormData,
): Promise<RosterTagMutationResult> {
  const guildId = getString(formData, "guildId");
  const tagId = getString(formData, "tagId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(tagId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_roster_tag", {
    p_tag_id: tagId,
  });

  if (error) {
    return { ok: false, message: mapTagError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Roster tag deleted." };
}

export async function setCharacterRosterTagsAction(
  formData: FormData,
): Promise<RosterTagMutationResult> {
  const guildId = getString(formData, "guildId");
  const characterId = getString(formData, "characterId");

  if (!UUID_PATTERN.test(guildId) || !UUID_PATTERN.test(characterId)) {
    return { ok: false, message: "The roster identifiers are invalid." };
  }

  const parsedIds = parseRosterTagIds(formData.getAll("tagId"));

  if (!parsedIds.ok) {
    return parsedIds;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_character_roster_tags", {
    p_character_id: characterId,
    p_tag_ids: parsedIds.value,
  });

  if (error) {
    return { ok: false, message: mapTagError(error.code) };
  }

  revalidatePath(rosterPath(guildId));
  return { ok: true, message: "Character tags saved." };
}
