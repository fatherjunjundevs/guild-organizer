"use server";

import { z } from "zod";
import type { Json } from "@/types/database.types";
import type {
  ImportHistoryScalar,
  RosterImportChange,
} from "@/features/roster/import-history";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  guildId: z.string().uuid(),
  syncRunId: z.string().uuid(),
});

function scalarRecord(
  value: Json,
): Record<string, ImportHistoryScalar> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result: Record<string, ImportHistoryScalar> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    if (
      fieldValue === null ||
      typeof fieldValue === "string" ||
      typeof fieldValue === "number" ||
      typeof fieldValue === "boolean"
    ) {
      result[key] = fieldValue;
    }
  }

  return result;
}

export async function loadRosterImportRunChangesAction(input: {
  guildId: string;
  syncRunId: string;
}): Promise<
  | { ok: true; changes: RosterImportChange[] }
  | { ok: false; message: string }
> {
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "The import history request is invalid.",
    };
  }

  const supabase = await createClient();
  const { data: run, error: runError } = await supabase
    .from("roster_sync_runs")
    .select("id")
    .eq("guild_id", parsed.data.guildId)
    .eq("id", parsed.data.syncRunId)
    .maybeSingle();

  if (runError || !run) {
    return {
      ok: false,
      message:
        "This import history is unavailable or you do not have permission to view it.",
    };
  }

  const pageSize = 500;
  let from = 0;
  const rows: RosterImportChange[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("roster_sync_run_changes")
      .select(
        "id,character_id,character_ign,change_kind,changed_fields,before_values,after_values,recorded_at",
      )
      .eq("guild_id", parsed.data.guildId)
      .eq("sync_run_id", parsed.data.syncRunId)
      .order("character_ign", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return {
        ok: false,
        message:
          "The Character changes for this import could not be loaded.",
      };
    }

    const page = data ?? [];

    rows.push(
      ...page.map((change) => ({
        id: change.id,
        characterId: change.character_id,
        characterIgn: change.character_ign,
        changeKind: change.change_kind,
        changedFields: change.changed_fields,
        beforeValues: scalarRecord(change.before_values),
        afterValues: scalarRecord(change.after_values),
        recordedAt: change.recorded_at,
      })),
    );

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return {
    ok: true,
    changes: rows,
  };
}
