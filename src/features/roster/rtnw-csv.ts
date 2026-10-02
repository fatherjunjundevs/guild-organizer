export const RTNW_OFFICIAL_HEADERS = [
  "Id",
  "Player",
  "Lv.",
  "Class",
  "Title",
  "Gender",
  "Position",
  "Gear Score",
  "Weekly",
  "Weekly Contribution",
  "Total Contribution",
  "Online Status",
] as const;

export type RtnwRosterRow = {
  ign: string;
  level: number;
  class_name: string | null;
  title: string | null;
  gender: string | null;
  guild_position: string | null;
  gear_score: number;
  weekly_activity: number;
  weekly_contribution: number;
  total_contribution: number;
  online_status: string | null;
};

export type RtnwCsvParseResult =
  | {
      ok: true;
      rows: RtnwRosterRow[];
      sourceRowCount: number;
    }
  | {
      ok: false;
      message: string;
    };

const MAX_ROWS = 1000;

function parseCsvRecords(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }

      row.push(value);
      value = "";

      if (row.some((cell) => cell.length > 0)) {
        records.push(row);
      }

      row = [];
      continue;
    }

    value += char;
  }

  if (inQuotes) {
    throw new Error("The CSV contains an unterminated quoted value.");
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);

    if (row.some((cell) => cell.length > 0)) {
      records.push(row);
    }
  }

  return records;
}

function nullableText(value: string, maxLength: number) {
  if (value === "") {
    return null;
  }

  if (value.length > maxLength) {
    throw new Error(`A text value exceeds ${maxLength} characters.`);
  }

  return value;
}

function requiredInteger(
  value: string,
  label: string,
  rowNumber: number,
) {
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Row ${rowNumber}: ${label} must be a nonnegative whole number.`,
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${label} is too large.`);
  }

  return parsed;
}

function headersMatch(actual: string[]) {
  return (
    actual.length === RTNW_OFFICIAL_HEADERS.length &&
    actual.every(
      (header, index) => header === RTNW_OFFICIAL_HEADERS[index],
    )
  );
}

export function parseOfficialRtnwCsv(
  input: string,
): RtnwCsvParseResult {
  let records: string[][];

  try {
    records = parseCsvRecords(input);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The CSV could not be parsed.",
    };
  }

  if (records.length < 2) {
    return {
      ok: false,
      message:
        "This file does not contain an RTNW Guild roster with at least one character.",
    };
  }

  const [headers, ...dataRows] = records;

  if (!headersMatch(headers)) {
    return {
      ok: false,
      message:
        "This does not match the recognized official RTNW Guild CSV schema. No column mapping was attempted.",
    };
  }

  if (dataRows.length > MAX_ROWS) {
    return {
      ok: false,
      message: `This roster contains more than ${MAX_ROWS} rows.`,
    };
  }

  const exactIgns = new Set<string>();
  const rows: RtnwRosterRow[] = [];

  try {
    for (let index = 0; index < dataRows.length; index += 1) {
      const values = dataRows[index];
      const rowNumber = index + 2;

      if (values.length !== RTNW_OFFICIAL_HEADERS.length) {
        throw new Error(
          `Row ${rowNumber}: expected ${RTNW_OFFICIAL_HEADERS.length} columns but found ${values.length}.`,
        );
      }

      const [
        exportId,
        ign,
        level,
        className,
        title,
        gender,
        position,
        gearScore,
        weekly,
        weeklyContribution,
        totalContribution,
        onlineStatus,
      ] = values;

      // Validate that the official export still provides an ordinary row/count
      // field, but intentionally do not store it or use it as identity.
      requiredInteger(exportId, "Id", rowNumber);

      if (
        ign.length < 1 ||
        ign.length > 80 ||
        ign !== ign.trim()
      ) {
        throw new Error(
          `Row ${rowNumber}: Player must be a 1–80 character exact IGN without surrounding whitespace.`,
        );
      }

      if (exactIgns.has(ign)) {
        throw new Error(
          `Row ${rowNumber}: duplicate exact IGN "${ign}" appears in this export.`,
        );
      }

      exactIgns.add(ign);

      rows.push({
        ign,
        level: requiredInteger(level, "Lv.", rowNumber),
        class_name: nullableText(className, 80),
        title: nullableText(title, 120),
        gender: nullableText(gender, 40),
        guild_position: nullableText(position, 80),
        gear_score: requiredInteger(
          gearScore,
          "Gear Score",
          rowNumber,
        ),
        weekly_activity: requiredInteger(
          weekly,
          "Weekly",
          rowNumber,
        ),
        weekly_contribution: requiredInteger(
          weeklyContribution,
          "Weekly Contribution",
          rowNumber,
        ),
        total_contribution: requiredInteger(
          totalContribution,
          "Total Contribution",
          rowNumber,
        ),
        online_status: nullableText(onlineStatus, 120),
      });
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The RTNW roster contains an invalid row.",
    };
  }

  return {
    ok: true,
    rows,
    sourceRowCount: rows.length,
  };
}

export async function readOfficialRtnwCsvFile(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    return {
      ok: false as const,
      message: "The CSV is larger than the 2 MB import limit.",
    };
  }

  let bytes: ArrayBuffer;
  let text: string;

  try {
    bytes = await file.arrayBuffer();
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false as const,
      message: "The file is not valid UTF-8 text.",
    };
  }

  const parsed = parseOfficialRtnwCsv(text);

  if (!parsed.ok) {
    return parsed;
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    ...parsed,
    filename: file.name,
    sha256,
  };
}
