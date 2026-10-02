import { describe, expect, it } from "vitest";
import {
  RTNW_OFFICIAL_HEADERS,
  parseOfficialRtnwCsv,
} from "@/features/roster/rtnw-csv";

function csv(...rows: string[][]) {
  return [RTNW_OFFICIAL_HEADERS, ...rows]
    .map((row) => row.join(","))
    .join("\r\n");
}

const baseRow = [
  "1",
  "焱｜Example",
  "82",
  "High Priest",
  "Pathfinder I",
  "F",
  "Elite",
  "50082",
  "760",
  "1968",
  "18126",
  "[Online]",
];

describe("official RTNW CSV parser", () => {
  it("recognizes the exact official schema with UTF-8 BOM and CRLF", () => {
    const result = parseOfficialRtnwCsv(
      `\uFEFF${csv(baseRow)}`,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.sourceRowCount).toBe(1);
      expect(result.rows[0]).toEqual({
        ign: "焱｜Example",
        level: 82,
        class_name: "High Priest",
        title: "Pathfinder I",
        gender: "F",
        guild_position: "Elite",
        gear_score: 50082,
        weekly_activity: 760,
        weekly_contribution: 1968,
        total_contribution: 18126,
        online_status: "[Online]",
      });
    }
  });

  it("does not retain the export Id as character identity", () => {
    const result = parseOfficialRtnwCsv(
      csv(["999", ...baseRow.slice(1)]),
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows[0]).not.toHaveProperty("id");
      expect(result.rows[0].ign).toBe("焱｜Example");
    }
  });

  it("preserves Unicode and symbol-heavy IGNs exactly", () => {
    const result = parseOfficialRtnwCsv(csv(baseRow));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows[0].ign).toBe("焱｜Example");
    }
  });

  it("rejects a changed or unknown header schema", () => {
    const wrongHeaders: string[] = [...RTNW_OFFICIAL_HEADERS];
    wrongHeaders[1] = "Character";

    const result = parseOfficialRtnwCsv(
      [wrongHeaders.join(","), baseRow.join(",")].join("\r\n"),
    );

    expect(result).toEqual({
      ok: false,
      message:
        "This does not match the recognized official RTNW Guild CSV schema. No column mapping was attempted.",
    });
  });

  it("rejects duplicate exact IGNs", () => {
    const secondRow = ["2", ...baseRow.slice(1)];
    const result = parseOfficialRtnwCsv(csv(baseRow, secondRow));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).toContain("duplicate exact IGN");
    }
  });

  it("keeps differently cased IGNs separate in v1", () => {
    const first = [...baseRow];
    first[1] = "Example";
    const second = ["2", ...baseRow.slice(1)];
    second[1] = "example";

    const result = parseOfficialRtnwCsv(csv(first, second));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows.map((row) => row.ign)).toEqual([
        "Example",
        "example",
      ]);
    }
  });

  it("rejects negative or malformed numeric fields", () => {
    const invalid = [...baseRow];
    invalid[7] = "-1";

    const result = parseOfficialRtnwCsv(csv(invalid));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).toContain("Gear Score");
    }
  });

  it("maps blank optional text fields to null", () => {
    const blankOptional = [...baseRow];
    blankOptional[4] = "";
    blankOptional[5] = "";
    blankOptional[6] = "";
    blankOptional[11] = "";

    const result = parseOfficialRtnwCsv(csv(blankOptional));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows[0].title).toBeNull();
      expect(result.rows[0].gender).toBeNull();
      expect(result.rows[0].guild_position).toBeNull();
      expect(result.rows[0].online_status).toBeNull();
    }
  });

  it("parses quoted fields without splitting embedded commas", () => {
    const quoted = [...baseRow];
    quoted[4] = '"Pathfinder, I"';

    const result = parseOfficialRtnwCsv(csv(quoted));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows[0].title).toBe("Pathfinder, I");
    }
  });
});
