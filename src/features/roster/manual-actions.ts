"use server";

import { revalidatePath } from "next/cache";
import {
  parseCharacterOrganizationInput,
  parseManualCharacterInput,
} from "@/features/roster/manual-character";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RosterManualMutationResult =
  | { ok: true; message: string; characterId: string }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

function mapRosterRpcError(code: string | undefined) {
  if (code === "23505") {
    return "That exact IGN already exists in this Guild.";
  }

  if (code === "42501") {
    return "You do not have permission to manage this roster.";
  }

  return "The roster change could not be saved.";
}

export async function createManualCharacterAction(
  formData: FormData,
): Promise<RosterManualMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!UUID_PATTERN.test(guildId)) {
    return {
      ok: false,
      message: "The Guild identifier is invalid.",
    };
  }

  const parsed = parseManualCharacterInput({
    ign: getString(formData, "ign"),
    level: getString(formData, "level"),
    className: getString(formData, "className"),
    guildPosition: getString(formData, "guildPosition"),
    gearScore: getString(formData, "gearScore"),
    designation: getString(formData, "designation"),
    roleLabel: getString(formData, "roleLabel"),
  });

  if (!parsed.ok) {
    return parsed;
  }

  const input = parsed.value;
  const args: {
    p_guild_id: string;
    p_ign: string;
    p_level?: number;
    p_class_name?: string;
    p_guild_position?: string;
    p_gear_score?: number;
    p_designation?: string;
    p_role_label?: string;
  } = {
    p_guild_id: guildId,
    p_ign: input.ign,
  };

  if (input.level !== undefined) {
    args.p_level = input.level;
  }

  if (input.className !== undefined) {
    args.p_class_name = input.className;
  }

  if (input.guildPosition !== undefined) {
    args.p_guild_position = input.guildPosition;
  }

  if (input.gearScore !== undefined) {
    args.p_gear_score = input.gearScore;
  }

  if (input.designation !== undefined) {
    args.p_designation = input.designation;
  }

  if (input.roleLabel !== undefined) {
    args.p_role_label = input.roleLabel;
  }

  const supabase = await createClient();
  const { data: characterId, error } = await supabase.rpc(
    "create_roster_character",
    args,
  );

  if (error || !characterId) {
    return {
      ok: false,
      message: mapRosterRpcError(error?.code),
    };
  }

  revalidatePath(rosterPath(guildId));

  return {
    ok: true,
    message: `${input.ign} was added to the Master Roster.`,
    characterId,
  };
}

export async function updateCharacterOrganizationAction(
  formData: FormData,
): Promise<RosterManualMutationResult> {
  const guildId = getString(formData, "guildId");
  const characterId = getString(formData, "characterId");

  if (
    !UUID_PATTERN.test(guildId) ||
    !UUID_PATTERN.test(characterId)
  ) {
    return {
      ok: false,
      message: "The roster identifiers are invalid.",
    };
  }

  const parsed = parseCharacterOrganizationInput({
    status: getString(formData, "status"),
    designation: getString(formData, "designation"),
    roleLabel: getString(formData, "roleLabel"),
  });

  if (!parsed.ok) {
    return parsed;
  }

  const supabase = await createClient();

  // SQL accepts NULL for these arguments. Generated RPC types cannot express
  // parameter nullability, so the localized casts preserve the real SQL API.
  const designation =
    parsed.value.designation as unknown as string;
  const roleLabel =
    parsed.value.roleLabel as unknown as string;

  const { error: profileError } = await supabase.rpc(
    "set_character_roster_profile",
    {
      p_character_id: characterId,
      p_designation: designation,
      p_role_label: roleLabel,
    },
  );

  if (profileError) {
    return {
      ok: false,
      message: mapRosterRpcError(profileError.code),
    };
  }

  const { error: statusError } = await supabase.rpc(
    "set_character_manual_status",
    {
      p_character_id: characterId,
      p_status: parsed.value.status,
    },
  );

  if (statusError) {
    return {
      ok: false,
      message: mapRosterRpcError(statusError.code),
    };
  }

  revalidatePath(rosterPath(guildId));

  return {
    ok: true,
    message: "Character organization settings were saved.",
    characterId,
  };
}
