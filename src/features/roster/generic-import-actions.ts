"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  GENERIC_MUTABLE_FIELD_KEYS,
  type GenericMutableFieldKey,
  type GenericRosterRpcRow,
} from "@/features/roster/generic-spreadsheet-import";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const trimmedText = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value === value.trim())
    .nullable();

const safeWholeNumber = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger);

const genericRowSchema = z
  .object({
    ign: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => value === value.trim()),
    level: safeWholeNumber.max(2147483647).nullable().optional(),
    class_name: trimmedText(80).optional(),
    title: trimmedText(120).optional(),
    gender: trimmedText(40).optional(),
    guild_position: trimmedText(80).optional(),
    gear_score: safeWholeNumber.nullable().optional(),
    weekly_activity: safeWholeNumber.nullable().optional(),
    weekly_contribution: safeWholeNumber.nullable().optional(),
    total_contribution: safeWholeNumber.nullable().optional(),
    online_status: trimmedText(120).optional(),
    designation: z.enum(["main", "sub"]).nullable().optional(),
    role_label: trimmedText(80).optional(),
  })
  .strict();

const mappedFieldSchema = z.enum(GENERIC_MUTABLE_FIELD_KEYS);

const importRequestSchema = z
  .object({
    guildId: z.string().regex(UUID_PATTERN),
    rows: z.array(genericRowSchema).min(1).max(1000),
    mappedFields: z.array(mappedFieldSchema).max(
      GENERIC_MUTABLE_FIELD_KEYS.length,
    ),
  })
  .superRefine((value, context) => {
    const mapped = new Set<GenericMutableFieldKey>();

    for (const field of value.mappedFields) {
      if (mapped.has(field)) {
        context.addIssue({
          code: "custom",
          path: ["mappedFields"],
          message: "Mapped fields cannot contain duplicates.",
        });
      }

      mapped.add(field);
    }

    for (let rowIndex = 0; rowIndex < value.rows.length; rowIndex += 1) {
      const row = value.rows[rowIndex];

      for (const field of mapped) {
        if (!Object.prototype.hasOwnProperty.call(row, field)) {
          context.addIssue({
            code: "custom",
            path: ["rows", rowIndex, field],
            message: `Mapped field ${field} is missing from a row.`,
          });
        }
      }

      for (const key of Object.keys(row)) {
        if (key === "ign") continue;

        if (!mapped.has(key as GenericMutableFieldKey)) {
          context.addIssue({
            code: "custom",
            path: ["rows", rowIndex, key],
            message: `Row contains unmapped field ${key}.`,
          });
        }
      }
    }
  });

const applyRequestSchema = importRequestSchema.and(
  z.object({
    sourceFilename: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => value === value.trim()),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
);

export type GenericSpreadsheetPreviewChange = {
  changeKind: "new" | "update" | "unchanged";
  characterId: string | null;
  ign: string;
  changedFields: GenericMutableFieldKey[];
};

export type GenericSpreadsheetImportSummary = {
  syncRunId: string;
  sourceRowCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
};

function rosterPath(guildId: string) {
  return `/app/guild/${guildId}/roster`;
}

function rowsAsJson(rows: GenericRosterRpcRow[]) {
  return rows as unknown as Json;
}

export async function previewGenericSpreadsheetImportAction(input: {
  guildId: string;
  rows: GenericRosterRpcRow[];
  mappedFields: GenericMutableFieldKey[];
}): Promise<
  | { ok: true; changes: GenericSpreadsheetPreviewChange[] }
  | { ok: false; message: string }
> {
  const parsed = importRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "The spreadsheet preview request is invalid. Review the mapped columns and row errors.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "preview_generic_roster_import",
    {
      p_guild_id: parsed.data.guildId,
      p_rows: rowsAsJson(parsed.data.rows),
      p_mapped_fields: parsed.data.mappedFields,
    },
  );

  if (error) {
    return {
      ok: false,
      message:
        "Unable to preview this spreadsheet import. Check your import permission and try again.",
    };
  }

  return {
    ok: true,
    changes: (data ?? []).map((change) => ({
      changeKind:
        change.change_kind === "new" ||
        change.change_kind === "update"
          ? change.change_kind
          : "unchanged",
      characterId: change.character_id ?? null,
      ign: change.ign,
      changedFields: (change.changed_fields ?? []).filter(
        (field): field is GenericMutableFieldKey =>
          GENERIC_MUTABLE_FIELD_KEYS.includes(
            field as GenericMutableFieldKey,
          ),
      ),
    })),
  };
}

export async function applyGenericSpreadsheetImportAction(input: {
  guildId: string;
  rows: GenericRosterRpcRow[];
  mappedFields: GenericMutableFieldKey[];
  sourceFilename: string;
  sourceSha256: string;
}): Promise<
  | { ok: true; summary: GenericSpreadsheetImportSummary }
  | { ok: false; message: string }
> {
  const parsed = applyRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "The spreadsheet import request is invalid. Preview the file again before applying it.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "apply_generic_roster_import",
    {
      p_guild_id: parsed.data.guildId,
      p_rows: rowsAsJson(parsed.data.rows),
      p_mapped_fields: parsed.data.mappedFields,
      p_source_filename: parsed.data.sourceFilename,
      p_source_sha256: parsed.data.sourceSha256,
    },
  );

  const result = data?.[0];

  if (error || !result) {
    return {
      ok: false,
      message:
        "Unable to apply this spreadsheet import. No confirmed result was returned.",
    };
  }

  revalidatePath(rosterPath(parsed.data.guildId));

  return {
    ok: true,
    summary: {
      syncRunId: result.sync_run_id,
      sourceRowCount: result.source_row_count,
      createdCount: result.created_count,
      updatedCount: result.updated_count,
      unchangedCount: result.unchanged_count,
    },
  };
}
