import ExcelJS from "exceljs-hardened";
import { describe, expect, it } from "vitest";
import {
  MAX_GENERIC_SPREADSHEET_BYTES,
  readGenericSpreadsheetBytes,
} from "@/features/roster/spreadsheet-file";

describe("generic spreadsheet file reader", () => {
  it("reads quoted CSV data and preserves source row numbers", async () => {
    const csv = [
      "Player,Class,Title",
      '"Father,JunJun","High Priest","Pathfinder I"',
      "ArcherMain,Sniper,",
    ].join("\r\n");

    const result = await readGenericSpreadsheetBytes({
      filename: "guild-roster.csv",
      bytes: new TextEncoder().encode(csv),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.grid.headers).toEqual([
      "Player",
      "Class",
      "Title",
    ]);
    expect(result.grid.rows).toEqual([
      ["Father,JunJun", "High Priest", "Pathfinder I"],
      ["ArcherMain", "Sniper", ""],
    ]);
    expect(result.grid.rowNumbers).toEqual([2, 3]);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads the first XLSX worksheet without executing spreadsheet formulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Guild Roster");

    worksheet.addRow(["IGN", "Level", "Gear Score"]);
    worksheet.addRow(["FatherJunJun", 82, 55000]);
    worksheet.getCell("B3").value = {
      formula: "40+42",
      result: 82,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await readGenericSpreadsheetBytes({
      filename: "guild-roster.xlsx",
      bytes: new Uint8Array(buffer),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.grid.sheetName).toBe("Guild Roster");
    expect(result.grid.headers).toEqual([
      "IGN",
      "Level",
      "Gear Score",
    ]);
    expect(result.grid.rows[0]).toEqual([
      "FatherJunJun",
      82,
      55000,
    ]);
  });

  it("rejects unsupported legacy XLS files", async () => {
    const result = await readGenericSpreadsheetBytes({
      filename: "old-roster.xls",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      message:
        "Choose a .csv or .xlsx spreadsheet. Legacy .xls files are not supported.",
    });
  });

  it("rejects files larger than the import limit", async () => {
    const result = await readGenericSpreadsheetBytes({
      filename: "large.csv",
      bytes: new Uint8Array(MAX_GENERIC_SPREADSHEET_BYTES + 1),
    });

    expect(result).toEqual({
      ok: false,
      message: "Choose a spreadsheet up to 5 MB.",
    });
  });
});
