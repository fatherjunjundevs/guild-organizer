"use server";

import { revalidatePath } from "next/cache";
import { parseBulkRosterActionInput } from "@/features/roster/bulk-roster";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BulkRosterMutationResult =
  | { ok: true; message: string; updatedCount: number }
  | { ok: false; message: string };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function mapBulkRosterError(code: string | undefined) {
  if (code === "42501") {
    return "You do not have permission to manage every selected character.";
  }

  if (code === "22023") {
    return "The bulk roster change is invalid.";
  }

  if (code === "P0002") {
    return "One or more selected characters could not be found.";
  }

  return "The bulk roster change could not be saved.";
}

export async function bulkUpdateRosterAction(
  formData: FormData,
): Promise<BulkRosterMutationResult> {
  const guildId = getString(formData, "guildId");

  if (!UUID_PATTERN.test(guildId)) {
    return {
      ok: false,
      message: "The Guild identifier is invalid.",
    };
  }

  const parsed = parseBulkRosterActionInput({
    characterIdsJson: getString(formData, "characterIdsJson"),
    action: getString(formData, "action"),
    value: getString(formData, "value"),
  });

  if (!parsed.ok) {
    return parsed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "bulk_update_roster_characters",
    {
      p_character_ids: parsed.value.characterIds,
      p_action: parsed.value.action,
      p_value: parsed.value.value,
    },
  );

  if (error) {
    return {
      ok: false,
      message: mapBulkRosterError(error.code),
    };
  }

  const updatedCount = Number(data ?? 0);

  revalidatePath(`/app/guild/${guildId}/roster`);

  return {
    ok: true,
    message: `${updatedCount} character${
      updatedCount === 1 ? "" : "s"
    } updated.`,
    updatedCount,
  };
}
