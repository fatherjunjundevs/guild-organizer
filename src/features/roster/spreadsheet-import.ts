export const GENERIC_ROSTER_FIELD_DEFINITIONS = [
  {
    key: "ign",
    label: "IGN / Player",
    required: true,
    aliases: [
      "ign",
      "player",
      "player name",
      "character",
      "character name",
      "character ign",
      "name",
    ],
  },
  {
    key: "level",
    label: "Level",
    required: false,
    aliases: ["level", "lv", "lv.", "lvl"],
  },
  {
    key: "class_name",
    label: "Class",
    required: false,
    aliases: ["class", "job", "job class"],
  },
  {
    key: "title",
    label: "Title",
    required: false,
    aliases: ["title"],
  },
  {
    key: "gender",
    label: "Gender",
    required: false,
    aliases: ["gender", "sex"],
  },
  {
    key: "guild_position",
    label: "Guild Position",
    required: false,
    aliases: [
      "position",
      "guild position",
      "guild rank",
      "guild role",
      "rank",
    ],
  },
  {
    key: "gear_score",
    label: "Gear Score",
    required: false,
    aliases: ["gear score", "gearscore", "gs"],
  },
  {
    key: "weekly_activity",
    label: "Weekly Activity",
    required: false,
    aliases: ["weekly", "weekly activity", "activity"],
  },
  {
    key: "weekly_contribution",
    label: "Weekly Contribution",
    required: false,
    aliases: [
      "weekly contribution",
      "weekly contrib",
      "weekly contribution points",
    ],
  },
  {
    key: "total_contribution",
    label: "Total Contribution",
    required: false,
    aliases: [
      "total contribution",
      "total contrib",
      "total contribution points",
    ],
  },
  {
    key: "online_status",
    label: "Online Status",
    required: false,
    aliases: ["online status", "last online", "online"],
  },
  {
    key: "designation",
    label: "Designation",
    required: false,
    aliases: [
      "designation",
      "main sub",
      "main/sub",
      "character designation",
    ],
  },
  {
    key: "role_label",
    label: "Organizer Role",
    required: false,
    aliases: [
      "organizer role",
      "roster role",
      "event role",
      "organizer role label",
    ],
  },
] as const;

export type GenericRosterFieldKey =
  (typeof GENERIC_ROSTER_FIELD_DEFINITIONS)[number]["key"];

export type SpreadsheetCell = string | number | boolean | null;

export type SpreadsheetGrid = {
  headers: string[];
  rows: SpreadsheetCell[][];
  rowNumbers: number[];
  sheetName: string | null;
};

export type SpreadsheetColumnMapping = Partial<
  Record<GenericRosterFieldKey, number>
>;

export type SpreadsheetMappingSuggestion = {
  fieldKey: GenericRosterFieldKey;
  columnIndex: number;
  header: string;
};

export type SpreadsheetMappingAmbiguity = {
  fieldKey: GenericRosterFieldKey;
  columnIndexes: number[];
  headers: string[];
};

export type SpreadsheetMappingDetection = {
  mapping: SpreadsheetColumnMapping;
  suggestions: SpreadsheetMappingSuggestion[];
  ambiguities: SpreadsheetMappingAmbiguity[];
};

export type GenericRosterImportRow = {
  sourceRowNumber: number;
  ign: string;
  level?: number | null;
  class_name?: string | null;
  title?: string | null;
  gender?: string | null;
  guild_position?: string | null;
  gear_score?: number | null;
  weekly_activity?: number | null;
  weekly_contribution?: number | null;
  total_contribution?: number | null;
  online_status?: string | null;
  designation?: "main" | "sub" | null;
  role_label?: string | null;
};

export type SpreadsheetImportIssue = {
  severity: "error" | "warning";
  rowNumber: number | null;
  fieldKey?: GenericRosterFieldKey;
  message: string;
};

export type SpreadsheetImportAnalysis = {
  rows: GenericRosterImportRow[];
  issues: SpreadsheetImportIssue[];
  sourceRowCount: number;
  validRowCount: number;
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
};

const TEXT_LIMITS: Partial<Record<GenericRosterFieldKey, number>> = {
  ign: 80,
  class_name: 80,
  title: 120,
  gender: 40,
  guild_position: 80,
  online_status: 120,
  role_label: 80,
};

const INTEGER_FIELDS = new Set<GenericRosterFieldKey>([
  "level",
  "gear_score",
  "weekly_activity",
  "weekly_contribution",
  "total_contribution",
]);

function normalizeHeader(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const aliasesByField = new Map<
  GenericRosterFieldKey,
  Set<string>
>(
  GENERIC_ROSTER_FIELD_DEFINITIONS.map((definition) => [
    definition.key,
    new Set(definition.aliases.map(normalizeHeader)),
  ]),
);

function isBlankCell(value: SpreadsheetCell) {
  return value === null || (typeof value === "string" && value.trim() === "");
}

function cellText(value: SpreadsheetCell) {
  if (value === null) {
    return "";
  }

  return String(value);
}

export function autoDetectSpreadsheetMapping(
  headers: string[],
): SpreadsheetMappingDetection {
  const mapping: SpreadsheetColumnMapping = {};
  const suggestions: SpreadsheetMappingSuggestion[] = [];
  const ambiguities: SpreadsheetMappingAmbiguity[] = [];
  const claimedColumns = new Set<number>();

  for (const definition of GENERIC_ROSTER_FIELD_DEFINITIONS) {
    const aliases = aliasesByField.get(definition.key);
    if (!aliases) continue;

    const matchingIndexes = headers.flatMap((header, index) =>
      aliases.has(normalizeHeader(header)) ? [index] : [],
    );

    if (matchingIndexes.length > 1) {
      ambiguities.push({
        fieldKey: definition.key,
        columnIndexes: matchingIndexes,
        headers: matchingIndexes.map((index) => headers[index]),
      });
      continue;
    }

    const columnIndex = matchingIndexes[0];

    if (columnIndex === undefined || claimedColumns.has(columnIndex)) {
      continue;
    }

    mapping[definition.key] = columnIndex;
    claimedColumns.add(columnIndex);
    suggestions.push({
      fieldKey: definition.key,
      columnIndex,
      header: headers[columnIndex],
    });
  }

  return { mapping, suggestions, ambiguities };
}

export function validateSpreadsheetMapping(
  headers: string[],
  mapping: SpreadsheetColumnMapping,
): SpreadsheetImportIssue[] {
  const issues: SpreadsheetImportIssue[] = [];
  const usedColumns = new Map<number, GenericRosterFieldKey>();

  if (mapping.ign === undefined) {
    issues.push({
      severity: "error",
      rowNumber: null,
      fieldKey: "ign",
      message: "Map one spreadsheet column to IGN / Player.",
    });
  }

  for (const definition of GENERIC_ROSTER_FIELD_DEFINITIONS) {
    const columnIndex = mapping[definition.key];

    if (columnIndex === undefined) {
      continue;
    }

    if (
      !Number.isInteger(columnIndex) ||
      columnIndex < 0 ||
      columnIndex >= headers.length
    ) {
      issues.push({
        severity: "error",
        rowNumber: null,
        fieldKey: definition.key,
        message: `${definition.label} is mapped to an invalid column.`,
      });
      continue;
    }

    const alreadyUsedBy = usedColumns.get(columnIndex);

    if (alreadyUsedBy) {
      issues.push({
        severity: "error",
        rowNumber: null,
        fieldKey: definition.key,
        message: `Spreadsheet column "${headers[columnIndex]}" is mapped more than once.`,
      });
      continue;
    }

    usedColumns.set(columnIndex, definition.key);
  }

  return issues;
}

function parseTextValue(
  value: SpreadsheetCell,
  fieldKey: GenericRosterFieldKey,
  rowNumber: number,
  issues: SpreadsheetImportIssue[],
) {
  if (isBlankCell(value)) {
    return null;
  }

  const text = cellText(value).trim();
  const maxLength = TEXT_LIMITS[fieldKey];

  if (maxLength !== undefined && text.length > maxLength) {
    issues.push({
      severity: "error",
      rowNumber,
      fieldKey,
      message: `${fieldKey} exceeds ${maxLength} characters.`,
    });
    return null;
  }

  return text;
}

function parseIgn(
  value: SpreadsheetCell,
  rowNumber: number,
  issues: SpreadsheetImportIssue[],
) {
  if (isBlankCell(value)) {
    issues.push({
      severity: "error",
      rowNumber,
      fieldKey: "ign",
      message: "IGN / Player is required.",
    });
    return null;
  }

  const text = cellText(value);

  if (text !== text.trim()) {
    issues.push({
      severity: "error",
      rowNumber,
      fieldKey: "ign",
      message:
        "IGN cannot have leading or trailing whitespace because exact IGN is the roster identity key.",
    });
    return null;
  }

  if (text.length > 80) {
    issues.push({
      severity: "error",
      rowNumber,
      fieldKey: "ign",
      message: "IGN exceeds 80 characters.",
    });
    return null;
  }

  return text;
}

function parseIntegerValue(
  value: SpreadsheetCell,
  fieldKey: GenericRosterFieldKey,
  rowNumber: number,
  issues: SpreadsheetImportIssue[],
) {
  if (isBlankCell(value)) {
    return null;
  }

  let parsed: number | null = null;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");

    if (/^\d+$/.test(normalized)) {
      parsed = Number(normalized);
    }
  }

  if (
    parsed === null ||
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    issues.push({
      severity: "error",
      rowNumber,
      fieldKey,
      message: `${fieldKey} must be a nonnegative whole number.`,
    });
    return null;
  }

  return parsed;
}

function parseDesignation(
  value: SpreadsheetCell,
  rowNumber: number,
  issues: SpreadsheetImportIssue[],
) {
  if (isBlankCell(value)) {
    return null;
  }

  const normalized = cellText(value).trim().toLocaleLowerCase();

  if (normalized === "main" || normalized === "sub") {
    return normalized;
  }

  issues.push({
    severity: "error",
    rowNumber,
    fieldKey: "designation",
    message: 'Designation must be "main", "sub", or blank.',
  });

  return null;
}

function mappedValue(
  row: SpreadsheetCell[],
  mapping: SpreadsheetColumnMapping,
  fieldKey: GenericRosterFieldKey,
) {
  const columnIndex = mapping[fieldKey];
  return columnIndex === undefined ? undefined : (row[columnIndex] ?? null);
}

function rowIsBlank(row: SpreadsheetCell[]) {
  return row.every(isBlankCell);
}

export function analyzeSpreadsheetImport(
  grid: SpreadsheetGrid,
  mapping: SpreadsheetColumnMapping,
): SpreadsheetImportAnalysis {
  const issues = validateSpreadsheetMapping(grid.headers, mapping);

  if (issues.some((issue) => issue.severity === "error")) {
    return {
      rows: [],
      issues,
      sourceRowCount: grid.rows.length,
      validRowCount: 0,
      errorCount: issues.length,
      warningCount: 0,
      hasErrors: true,
    };
  }

  const rows: GenericRosterImportRow[] = [];
  const rowHasError = new Set<number>();

  for (let index = 0; index < grid.rows.length; index += 1) {
    const sourceRow = grid.rows[index];
    const sourceRowNumber = grid.rowNumbers[index] ?? index + 2;

    if (rowIsBlank(sourceRow)) {
      continue;
    }

    const issueCountBefore = issues.length;
    const ignValue = mappedValue(sourceRow, mapping, "ign");
    const ign = parseIgn(ignValue ?? null, sourceRowNumber, issues);

    if (!ign) {
      rowHasError.add(sourceRowNumber);
      continue;
    }

    const parsed: GenericRosterImportRow = {
      sourceRowNumber,
      ign,
    };

    for (const definition of GENERIC_ROSTER_FIELD_DEFINITIONS) {
      const fieldKey = definition.key;

      if (fieldKey === "ign" || mapping[fieldKey] === undefined) {
        continue;
      }

      const value = mappedValue(sourceRow, mapping, fieldKey);

      if (INTEGER_FIELDS.has(fieldKey)) {
        const parsedInteger = parseIntegerValue(
          value ?? null,
          fieldKey,
          sourceRowNumber,
          issues,
        );

        if (fieldKey === "level") parsed.level = parsedInteger;
        if (fieldKey === "gear_score") parsed.gear_score = parsedInteger;
        if (fieldKey === "weekly_activity") {
          parsed.weekly_activity = parsedInteger;
        }
        if (fieldKey === "weekly_contribution") {
          parsed.weekly_contribution = parsedInteger;
        }
        if (fieldKey === "total_contribution") {
          parsed.total_contribution = parsedInteger;
        }

        continue;
      }

      if (fieldKey === "designation") {
        parsed.designation = parseDesignation(
          value ?? null,
          sourceRowNumber,
          issues,
        );
        continue;
      }

      const parsedText = parseTextValue(
        value ?? null,
        fieldKey,
        sourceRowNumber,
        issues,
      );

      if (fieldKey === "class_name") parsed.class_name = parsedText;
      if (fieldKey === "title") parsed.title = parsedText;
      if (fieldKey === "gender") parsed.gender = parsedText;
      if (fieldKey === "guild_position") {
        parsed.guild_position = parsedText;
      }
      if (fieldKey === "online_status") {
        parsed.online_status = parsedText;
      }
      if (fieldKey === "role_label") parsed.role_label = parsedText;
    }

    if (issues.length > issueCountBefore) {
      rowHasError.add(sourceRowNumber);
    }

    rows.push(parsed);
  }

  const rowsByExactIgn = new Map<string, number[]>();

  for (const row of rows) {
    const sourceRows = rowsByExactIgn.get(row.ign) ?? [];
    sourceRows.push(row.sourceRowNumber);
    rowsByExactIgn.set(row.ign, sourceRows);
  }

  for (const [ign, sourceRows] of rowsByExactIgn) {
    if (sourceRows.length < 2) continue;

    for (const sourceRowNumber of sourceRows) {
      rowHasError.add(sourceRowNumber);
    }

    issues.push({
      severity: "error",
      rowNumber: sourceRows[1] ?? sourceRows[0],
      fieldKey: "ign",
      message: `Duplicate exact IGN "${ign}" appears on spreadsheet rows ${sourceRows.join(", ")}.`,
    });
  }

  const exactIgnsByFoldedIgn = new Map<
    string,
    Map<string, number[]>
  >();

  for (const row of rows) {
    const foldedIgn = row.ign.toLocaleLowerCase();
    const exactValues =
      exactIgnsByFoldedIgn.get(foldedIgn) ?? new Map<string, number[]>();
    const sourceRows = exactValues.get(row.ign) ?? [];
    sourceRows.push(row.sourceRowNumber);
    exactValues.set(row.ign, sourceRows);
    exactIgnsByFoldedIgn.set(foldedIgn, exactValues);
  }

  for (const exactValues of exactIgnsByFoldedIgn.values()) {
    if (exactValues.size < 2) continue;

    const variants = [...exactValues.keys()];
    const sourceRows = [...exactValues.values()].flat();

    issues.push({
      severity: "warning",
      rowNumber: sourceRows[0] ?? null,
      fieldKey: "ign",
      message:
        `Similar IGNs differ only by letter case (${variants.join(", ")}). ` +
        "Guild Organizer treats them as separate exact identities.",
    });
  }

  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.length - errorCount;

  return {
    rows,
    issues,
    sourceRowCount: grid.rows.length,
    validRowCount: rows.filter(
      (row) => !rowHasError.has(row.sourceRowNumber),
    ).length,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
  };
}
