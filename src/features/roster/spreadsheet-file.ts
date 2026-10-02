import { createHash } from "node:crypto";
import ExcelJS from "exceljs-hardened";
import type {
  SpreadsheetCell,
  SpreadsheetGrid,
} from "@/features/roster/spreadsheet-import";

export const MAX_GENERIC_SPREADSHEET_BYTES = 5 * 1024 * 1024;
export const MAX_GENERIC_SPREADSHEET_ROWS = 1000;
export const MAX_GENERIC_SPREADSHEET_COLUMNS = 100;

export type GenericSpreadsheetReadResult =
  | {
      ok: true;
      filename: string;
      sha256: string;
      grid: SpreadsheetGrid;
    }
  | {
      ok: false;
      message: string;
    };

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

function spreadsheetCellFromExcel(
  cell: ExcelJS.Cell,
): SpreadsheetCell {
  const value = cell.value;

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = cell.text;
  return text === "" ? null : text;
}

function cellHeader(value: SpreadsheetCell, index: number) {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? `Column ${index + 1}` : text;
}

function cellIsBlank(value: SpreadsheetCell) {
  return value === null || (typeof value === "string" && value.trim() === "");
}

function buildGrid(
  records: SpreadsheetCell[][],
  rowNumbers: number[],
  sheetName: string | null,
): SpreadsheetGrid | null {
  const headerRecordIndex = records.findIndex(
    (record) => !record.every(cellIsBlank),
  );

  if (headerRecordIndex < 0) {
    return null;
  }

  const rawHeaders = records[headerRecordIndex];

  if (rawHeaders.length > MAX_GENERIC_SPREADSHEET_COLUMNS) {
    throw new Error(
      `The spreadsheet has more than ${MAX_GENERIC_SPREADSHEET_COLUMNS} columns.`,
    );
  }

  const headers = rawHeaders.map(cellHeader);
  const rows: SpreadsheetCell[][] = [];
  const sourceRowNumbers: number[] = [];

  for (
    let index = headerRecordIndex + 1;
    index < records.length;
    index += 1
  ) {
    const record = records[index];

    if (record.every(cellIsBlank)) {
      continue;
    }

    if (record.length > MAX_GENERIC_SPREADSHEET_COLUMNS) {
      throw new Error(
        `Spreadsheet row ${rowNumbers[index]} has more than ${MAX_GENERIC_SPREADSHEET_COLUMNS} columns.`,
      );
    }

    rows.push(record);
    sourceRowNumbers.push(rowNumbers[index]);

    if (rows.length > MAX_GENERIC_SPREADSHEET_ROWS) {
      throw new Error(
        `The spreadsheet has more than ${MAX_GENERIC_SPREADSHEET_ROWS} data rows.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new Error("The spreadsheet does not contain any data rows.");
  }

  return {
    headers,
    rows,
    rowNumbers: sourceRowNumbers,
    sheetName,
  };
}

function readCsv(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const records = parseCsvRecords(text);
  const rowNumbers = records.map((_, index) => index + 1);
  return buildGrid(records, rowNumbers, null);
}

async function readXlsx(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  const workbookBytes = new Uint8Array(bytes).buffer;

  await workbook.xlsx.load(workbookBytes, {
    maxEntryUncompressedSize: 16 * 1024 * 1024,
    maxTotalUncompressedSize: 64 * 1024 * 1024,
  });

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return null;
  }

  const records: SpreadsheetCell[][] = [];
  const rowNumbers: number[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const columnCount = Math.min(
      row.cellCount,
      MAX_GENERIC_SPREADSHEET_COLUMNS + 1,
    );
    const record: SpreadsheetCell[] = [];

    for (let column = 1; column <= columnCount; column += 1) {
      record.push(spreadsheetCellFromExcel(row.getCell(column)));
    }

    records.push(record);
    rowNumbers.push(rowNumber);
  });

  return buildGrid(records, rowNumbers, worksheet.name);
}

export async function readGenericSpreadsheetBytes(input: {
  filename: string;
  bytes: Uint8Array;
}): Promise<GenericSpreadsheetReadResult> {
  const filename = input.filename.trim();

  if (!filename || filename.length > 255) {
    return {
      ok: false,
      message: "The spreadsheet filename is invalid.",
    };
  }

  if (
    input.bytes.byteLength === 0 ||
    input.bytes.byteLength > MAX_GENERIC_SPREADSHEET_BYTES
  ) {
    return {
      ok: false,
      message: "Choose a spreadsheet up to 5 MB.",
    };
  }

  const extension = filename
    .slice(filename.lastIndexOf("."))
    .toLocaleLowerCase();

  if (extension !== ".csv" && extension !== ".xlsx") {
    return {
      ok: false,
      message:
        "Choose a .csv or .xlsx spreadsheet. Legacy .xls files are not supported.",
    };
  }

  try {
    const grid =
      extension === ".csv"
        ? readCsv(input.bytes)
        : await readXlsx(input.bytes);

    if (!grid) {
      return {
        ok: false,
        message: "The spreadsheet is empty.",
      };
    }

    return {
      ok: true,
      filename,
      sha256: createHash("sha256")
        .update(input.bytes)
        .digest("hex"),
      grid,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The spreadsheet could not be read.",
    };
  }
}
