import { describe, expect, it } from "vitest";
import {
  buildGenericRosterRpcRows,
  countGenericPreviewChanges,
  mappedFieldsFromSpreadsheetMapping,
  updateSpreadsheetMappingColumn,
} from "@/features/roster/generic-spreadsheet-import";

describe("generic spreadsheet import request helpers", () => {
  it("returns mapped mutable fields in canonical order and excludes IGN", () => {
    expect(
      mappedFieldsFromSpreadsheetMapping({
        role_label: 4,
        ign: 0,
        class_name: 2,
        gear_score: 3,
      }),
    ).toEqual(["class_name", "gear_score", "role_label"]);
  });

  it("builds RPC rows without source row metadata or unmapped fields", () => {
    expect(
      buildGenericRosterRpcRows(
        [
          {
            sourceRowNumber: 7,
            ign: "FatherJunJun",
            class_name: "High Priest",
            title: "Keeper",
            gear_score: 55000,
          },
        ],
        ["class_name", "title"],
      ),
    ).toEqual([
      {
        ign: "FatherJunJun",
        class_name: "High Priest",
        title: "Keeper",
      },
    ]);
  });

  it("preserves explicit nulls for mapped fields", () => {
    expect(
      buildGenericRosterRpcRows(
        [
          {
            sourceRowNumber: 2,
            ign: "ArcherMain",
            title: null,
          },
        ],
        ["title"],
      ),
    ).toEqual([
      {
        ign: "ArcherMain",
        title: null,
      },
    ]);
  });

  it("moves a source column to the latest selected field instead of duplicating it", () => {
    expect(
      updateSpreadsheetMappingColumn(
        {
          ign: 0,
          class_name: 1,
        },
        "guild_position",
        1,
      ),
    ).toEqual({
      ign: 0,
      guild_position: 1,
    });
  });

  it("counts new, updated, and unchanged preview rows", () => {
    expect(
      countGenericPreviewChanges([
        { changeKind: "new" },
        { changeKind: "update" },
        { changeKind: "update" },
        { changeKind: "unchanged" },
      ]),
    ).toEqual({
      new: 1,
      update: 2,
      unchanged: 1,
    });
  });
});
