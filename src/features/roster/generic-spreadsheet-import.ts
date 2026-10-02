import type {
  GenericRosterFieldKey,
  GenericRosterImportRow,
  SpreadsheetColumnMapping,
} from "@/features/roster/spreadsheet-import";

export const GENERIC_MUTABLE_FIELD_KEYS = [
  "level",
  "class_name",
  "title",
  "gender",
  "guild_position",
  "gear_score",
  "weekly_activity",
  "weekly_contribution",
  "total_contribution",
  "online_status",
  "designation",
  "role_label",
] as const satisfies readonly GenericRosterFieldKey[];

export type GenericMutableFieldKey =
  (typeof GENERIC_MUTABLE_FIELD_KEYS)[number];

export type GenericRosterRpcRow = {
  ign: string;
} & Partial<
  Record<GenericMutableFieldKey, string | number | null>
>;

export type GenericPreviewChangeLike = {
  changeKind: string;
};

export function mappedFieldsFromSpreadsheetMapping(
  mapping: SpreadsheetColumnMapping,
): GenericMutableFieldKey[] {
  return GENERIC_MUTABLE_FIELD_KEYS.filter(
    (field) => mapping[field] !== undefined,
  );
}

export function buildGenericRosterRpcRows(
  rows: GenericRosterImportRow[],
  mappedFields: readonly GenericMutableFieldKey[],
): GenericRosterRpcRow[] {
  return rows.map((row) => {
    const payload: GenericRosterRpcRow = {
      ign: row.ign,
    };

    for (const field of mappedFields) {
      const value = row[field];
      payload[field] = value === undefined ? null : value;
    }

    return payload;
  });
}

export function updateSpreadsheetMappingColumn(
  mapping: SpreadsheetColumnMapping,
  fieldKey: GenericRosterFieldKey,
  columnIndex: number | null,
): SpreadsheetColumnMapping {
  const next = { ...mapping };

  delete next[fieldKey];

  if (columnIndex === null) {
    return next;
  }

  for (const [otherField, mappedColumn] of Object.entries(next)) {
    if (mappedColumn === columnIndex) {
      delete next[otherField as GenericRosterFieldKey];
    }
  }

  next[fieldKey] = columnIndex;

  return next;
}

export function countGenericPreviewChanges(
  changes: readonly GenericPreviewChangeLike[],
) {
  const counts = {
    new: 0,
    update: 0,
    unchanged: 0,
  };

  for (const change of changes) {
    if (change.changeKind === "new") counts.new += 1;
    if (change.changeKind === "update") counts.update += 1;
    if (change.changeKind === "unchanged") counts.unchanged += 1;
  }

  return counts;
}
