import { describe, expect, it } from "vitest";
import {
  analyzeSpreadsheetImport,
  autoDetectSpreadsheetMapping,
  validateSpreadsheetMapping,
  type SpreadsheetGrid,
} from "@/features/roster/spreadsheet-import";

function grid(
  headers: string[],
  rows: SpreadsheetGrid["rows"],
): SpreadsheetGrid {
  return {
    headers,
    rows,
    rowNumbers: rows.map((_, index) => index + 2),
    sheetName: null,
  };
}

describe("generic spreadsheet import mapping", () => {
  it("auto-detects known RTNW and organizer column aliases", () => {
    const result = autoDetectSpreadsheetMapping([
      "Player",
      "Lv.",
      "Class",
      "Position",
      "Gear Score",
      "Weekly",
      "Weekly Contribution",
      "Total Contribution",
      "Online Status",
      "Designation",
      "Organizer Role",
    ]);

    expect(result.ambiguities).toEqual([]);
    expect(result.mapping).toEqual({
      ign: 0,
      level: 1,
      class_name: 2,
      guild_position: 3,
      gear_score: 4,
      weekly_activity: 5,
      weekly_contribution: 6,
      total_contribution: 7,
      online_status: 8,
      designation: 9,
      role_label: 10,
    });
  });

  it("does not guess ambiguous generic status columns", () => {
    const result = autoDetectSpreadsheetMapping([
      "IGN",
      "Status",
    ]);

    expect(result.mapping).toEqual({ ign: 0 });
  });

  it("reports ambiguous duplicate candidate headers instead of guessing", () => {
    const result = autoDetectSpreadsheetMapping([
      "IGN",
      "Player",
      "Class",
    ]);

    expect(result.mapping.ign).toBeUndefined();
    expect(result.ambiguities).toEqual([
      {
        fieldKey: "ign",
        columnIndexes: [0, 1],
        headers: ["IGN", "Player"],
      },
    ]);
  });

  it("requires an IGN mapping and prevents one column from mapping twice", () => {
    expect(
      validateSpreadsheetMapping(["Player", "Class"], {
        class_name: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        fieldKey: "ign",
      }),
    ]);

    expect(
      validateSpreadsheetMapping(["Player"], {
        ign: 0,
        class_name: 0,
      }),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        fieldKey: "class_name",
      }),
    ]);
  });

  it("parses mapped numeric and organizer values without inventing unmapped fields", () => {
    const result = analyzeSpreadsheetImport(
      grid(
        [
          "Player",
          "Lv.",
          "Gear Score",
          "Designation",
          "Organizer Role",
        ],
        [["焱｜FatherJunJun", "82", "55,000", "MAIN", "Healer"]],
      ),
      {
        ign: 0,
        level: 1,
        gear_score: 2,
        designation: 3,
        role_label: 4,
      },
    );

    expect(result.hasErrors).toBe(false);
    expect(result.rows).toEqual([
      {
        sourceRowNumber: 2,
        ign: "焱｜FatherJunJun",
        level: 82,
        gear_score: 55000,
        designation: "main",
        role_label: "Healer",
      },
    ]);
  });

  it("keeps mapped blank cells as null so apply can intentionally clear them", () => {
    const result = analyzeSpreadsheetImport(
      grid(
        ["IGN", "Class", "Title"],
        [["ArcherMain", "", null]],
      ),
      {
        ign: 0,
        class_name: 1,
        title: 2,
      },
    );

    expect(result.hasErrors).toBe(false);
    expect(result.rows[0]).toMatchObject({
      ign: "ArcherMain",
      class_name: null,
      title: null,
    });
    expect("gear_score" in result.rows[0]).toBe(false);
  });

  it("rejects leading or trailing IGN whitespace instead of silently normalizing identity", () => {
    const result = analyzeSpreadsheetImport(
      grid(["IGN"], [["  PlayerOne  "]]),
      { ign: 0 },
    );

    expect(result.hasErrors).toBe(true);
    expect(result.issues[0]?.message).toContain(
      "leading or trailing whitespace",
    );
  });

  it("rejects invalid numeric and designation values", () => {
    const result = analyzeSpreadsheetImport(
      grid(
        ["IGN", "Gear Score", "Designation"],
        [
          ["PlayerOne", "-1", "main"],
          ["PlayerTwo", "not-a-number", "alternate"],
        ],
      ),
      {
        ign: 0,
        gear_score: 1,
        designation: 2,
      },
    );

    expect(result.hasErrors).toBe(true);
    expect(result.errorCount).toBe(3);
    expect(result.validRowCount).toBe(0);
  });

  it("blocks duplicate exact IGNs in one spreadsheet", () => {
    const result = analyzeSpreadsheetImport(
      grid(
        ["IGN", "Class"],
        [
          ["SameIGN", "High Priest"],
          ["SameIGN", "Sniper"],
        ],
      ),
      { ign: 0, class_name: 1 },
    );

    expect(result.hasErrors).toBe(true);
    expect(result.validRowCount).toBe(0);
    expect(
      result.issues.some((issue) =>
        issue.message.includes('Duplicate exact IGN "SameIGN"'),
      ),
    ).toBe(true);
  });

  it("warns but does not merge IGNs that differ only by case", () => {
    const result = analyzeSpreadsheetImport(
      grid(
        ["IGN"],
        [["PlayerOne"], ["playerone"]],
      ),
      { ign: 0 },
    );

    expect(result.hasErrors).toBe(false);
    expect(result.validRowCount).toBe(2);
    expect(result.warningCount).toBe(1);
    expect(result.issues[0]?.message).toContain(
      "separate exact identities",
    );
  });
});
