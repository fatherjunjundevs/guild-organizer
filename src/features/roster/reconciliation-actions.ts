"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reconciliationSchema = z
  .object({
    guildId: z.string().uuid(),
    sourceCharacterId: z.string().uuid(),
    targetCharacterId: z.string().uuid(),
    note: z.string().trim().max(500),
  })
  .refine(
    (value) => value.sourceCharacterId !== value.targetCharacterId,
    {
      message: "Source and target Characters must be different.",
      path: ["targetCharacterId"],
    },
  );

export type CharacterReconciliationMutationResult =
  | {
      ok: true;
      reconciliationId: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

function mapReconciliationError(
  code: string | undefined,
  message: string | undefined,
) {
  const normalized = message?.toLocaleLowerCase() ?? "";

  if (
    code === "22023" &&
    normalized.includes("organizer profile conflict")
  ) {
    return "These Characters have conflicting Designation or Organizer Role values. Resolve those organizer fields first, then retry reconciliation.";
  }

  if (
    code === "22023" &&
    normalized.includes("custom field conflict")
  ) {
    return "These Characters have conflicting custom-field values. Resolve the listed organizer fields first, then retry reconciliation.";
  }

  if (code === "55000") {
    return "One of these Characters was already reconciled. Refresh the roster and review the current canonical identity.";
  }

  if (code === "42501") {
    return "You do not have permission to reconcile these Characters, or they do not belong to the same Guild.";
  }

  if (code === "P0002") {
    return "One of the selected Characters could not be found.";
  }

  if (code === "22023") {
    return "The reconciliation request is invalid. Review the selected Characters and note, then try again.";
  }

  return "The Character reconciliation could not be completed.";
}

export async function reconcileRosterCharactersAction(input: {
  guildId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  note: string;
}): Promise<CharacterReconciliationMutationResult> {
  const parsed = reconciliationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "The reconciliation request is invalid.",
    };
  }

  const supabase = await createClient();
  const { data: selected, error: selectedError } = await supabase
    .from("characters")
    .select("id")
    .eq("guild_id", parsed.data.guildId)
    .in("id", [
      parsed.data.sourceCharacterId,
      parsed.data.targetCharacterId,
    ]);

  if (
    selectedError ||
    !selected ||
    new Set(selected.map((character) => character.id)).size !== 2
  ) {
    return {
      ok: false,
      message:
        "Both Characters must exist in the same Guild and be visible to your roster account.",
    };
  }

  const args: {
    p_source_character_id: string;
    p_target_character_id: string;
    p_note?: string;
  } = {
    p_source_character_id: parsed.data.sourceCharacterId,
    p_target_character_id: parsed.data.targetCharacterId,
  };

  if (parsed.data.note) {
    args.p_note = parsed.data.note;
  }

  const { data: reconciliationId, error } = await supabase.rpc(
    "reconcile_roster_character",
    args,
  );

  if (error || !reconciliationId) {
    return {
      ok: false,
      message: mapReconciliationError(error?.code, error?.message),
    };
  }

  revalidatePath(rosterPath(parsed.data.guildId));

  return {
    ok: true,
    reconciliationId,
    message:
      "Character identity reconciled. The source is preserved as read-only history and the selected target remains canonical.",
  };
}
