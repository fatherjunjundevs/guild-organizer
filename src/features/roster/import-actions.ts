"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RtnwRosterRow } from "@/features/roster/rtnw-csv";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rowSchema = z.object({
  ign: z.string().min(1).max(80),
  level: z.number().int().nonnegative(),
  class_name: z.string().min(1).max(80).nullable(),
  title: z.string().min(1).max(120).nullable(),
  gender: z.string().min(1).max(40).nullable(),
  guild_position: z.string().min(1).max(80).nullable(),
  gear_score: z.number().int().nonnegative(),
  weekly_activity: z.number().int().nonnegative(),
  weekly_contribution: z.number().int().nonnegative(),
  total_contribution: z.number().int().nonnegative(),
  online_status: z.string().min(1).max(120).nullable(),
});

const rowsSchema = z.array(rowSchema).min(1).max(1000);

const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/);

export type RtnwPreviewChange = {
  changeKind: string;
  characterId: string | null;
  ign: string;
};

export type RtnwSyncSummary = {
  syncRunId: string;
  sourceRowCount: number;
  createdCount: number;
  updatedCount: number;
  reactivatedCount: number;
  leftGuildCount: number;
  unchangedCount: number;
};

function validateGuildId(guildId: string) {
  return UUID_PATTERN.test(guildId);
}

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

export async function previewRtnwRosterSyncAction(input: {
  guildId: string;
  rows: RtnwRosterRow[];
}): Promise<
  | { ok: true; changes: RtnwPreviewChange[] }
  | { ok: false; message: string }
> {
  if (!validateGuildId(input.guildId)) {
    return {
      ok: false,
      message: "The Guild identifier is invalid.",
    };
  }

  const parsedRows = rowsSchema.safeParse(input.rows);

  if (!parsedRows.success) {
    return {
      ok: false,
      message: "The parsed RTNW roster is invalid.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "preview_rtnw_roster_sync",
    {
      p_guild_id: input.guildId,
      p_rows: parsedRows.data,
    },
  );

  if (error) {
    return {
      ok: false,
      message:
        "Unable to preview this roster sync. Check your import permission and try again.",
    };
  }

  return {
    ok: true,
    changes: (data ?? []).map((change) => ({
      changeKind: change.change_kind,
      characterId: change.character_id,
      ign: change.ign,
    })),
  };
}

export async function applyRtnwRosterSyncAction(input: {
  guildId: string;
  rows: RtnwRosterRow[];
  sourceFilename: string;
  sourceSha256: string;
}): Promise<
  | { ok: true; summary: RtnwSyncSummary }
  | { ok: false; message: string }
> {
  if (!validateGuildId(input.guildId)) {
    return {
      ok: false,
      message: "The Guild identifier is invalid.",
    };
  }

  const parsedRows = rowsSchema.safeParse(input.rows);
  const parsedFilename = z
    .string()
    .min(1)
    .max(255)
    .refine((value) => value === value.trim())
    .safeParse(input.sourceFilename);
  const parsedSha256 = sha256Schema.safeParse(
    input.sourceSha256,
  );

  if (
    !parsedRows.success ||
    !parsedFilename.success ||
    !parsedSha256.success
  ) {
    return {
      ok: false,
      message: "The RTNW import request is invalid.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "apply_rtnw_roster_sync",
    {
      p_guild_id: input.guildId,
      p_rows: parsedRows.data,
      p_source_filename: parsedFilename.data,
      p_source_sha256: parsedSha256.data,
    },
  );

  const result = data?.[0];

  if (error || !result) {
    return {
      ok: false,
      message:
        "Unable to apply this roster sync. No confirmed result was returned.",
    };
  }

  revalidatePath(rosterPath(input.guildId));

  return {
    ok: true,
    summary: {
      syncRunId: result.sync_run_id,
      sourceRowCount: result.source_row_count,
      createdCount: result.created_count,
      updatedCount: result.updated_count,
      reactivatedCount: result.reactivated_count,
      leftGuildCount: result.left_guild_count,
      unchangedCount: result.unchanged_count,
    },
  };
}
