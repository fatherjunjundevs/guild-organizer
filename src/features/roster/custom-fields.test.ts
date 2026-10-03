import { describe, expect, it } from "vitest";
import {
  parseRosterCustomFieldDefinition,
  parseRosterCustomFieldName,
  parseRosterCustomFieldOptions,
  parseRosterCustomFieldType,
  parseRosterCustomFieldValue,
} from "@/features/roster/custom-fields";

describe("roster custom fields", () => {
  it("trims and accepts a valid field name", () => {
    expect(parseRosterCustomFieldName("  Discord Name  ")).toEqual({
      ok: true,
      value: "Discord Name",
    });
  });

  it("rejects an empty or oversized field name", () => {
    expect(parseRosterCustomFieldName("   ").ok).toBe(false);
    expect(parseRosterCustomFieldName("x".repeat(41)).ok).toBe(false);
  });

  it("accepts the supported field types", () => {
    for (const fieldType of ["text", "number", "boolean", "select"]) {
      expect(parseRosterCustomFieldType(fieldType)).toEqual({
        ok: true,
        value: fieldType,
      });
    }
  });

  it("rejects an unsupported field type", () => {
    expect(parseRosterCustomFieldType("date").ok).toBe(false);
  });

  it("parses newline-separated Choice options", () => {
    expect(
      parseRosterCustomFieldOptions(
        "select",
        "Weekdays\nWeekends\nFlexible",
      ),
    ).toEqual({
      ok: true,
      value: ["Weekdays", "Weekends", "Flexible"],
    });
  });

  it("rejects duplicate Choice options case-insensitively", () => {
    expect(
      parseRosterCustomFieldOptions("select", "Raid\nraid").ok,
    ).toBe(false);
  });

  it("rejects Choice fields with fewer than two options", () => {
    expect(
      parseRosterCustomFieldOptions("select", "Only one").ok,
    ).toBe(false);
  });

  it("rejects options on non-Choice fields", () => {
    expect(
      parseRosterCustomFieldOptions("text", "Unexpected option").ok,
    ).toBe(false);
  });

  it("parses a complete Choice definition", () => {
    expect(
      parseRosterCustomFieldDefinition(
        "select",
        "Main Team\nReserve",
      ),
    ).toEqual({
      ok: true,
      value: {
        fieldType: "select",
        selectOptions: ["Main Team", "Reserve"],
      },
    });
  });

  it("treats an empty character value as unset", () => {
    expect(
      parseRosterCustomFieldValue(
        { fieldType: "text", selectOptions: [] },
        "   ",
      ),
    ).toEqual({ ok: true, value: null });
  });

  it("parses text, number, yes/no, and Choice values", () => {
    expect(
      parseRosterCustomFieldValue(
        { fieldType: "text", selectOptions: [] },
        " FatherJunJun ",
      ),
    ).toEqual({ ok: true, value: "FatherJunJun" });

    expect(
      parseRosterCustomFieldValue(
        { fieldType: "number", selectOptions: [] },
        "7.5",
      ),
    ).toEqual({ ok: true, value: 7.5 });

    expect(
      parseRosterCustomFieldValue(
        { fieldType: "boolean", selectOptions: [] },
        "false",
      ),
    ).toEqual({ ok: true, value: false });

    expect(
      parseRosterCustomFieldValue(
        {
          fieldType: "select",
          selectOptions: ["Weekdays", "Weekends"],
        },
        "Weekends",
      ),
    ).toEqual({ ok: true, value: "Weekends" });
  });

  it("rejects invalid typed character values", () => {
    expect(
      parseRosterCustomFieldValue(
        { fieldType: "number", selectOptions: [] },
        "seven",
      ).ok,
    ).toBe(false);

    expect(
      parseRosterCustomFieldValue(
        { fieldType: "boolean", selectOptions: [] },
        "maybe",
      ).ok,
    ).toBe(false);

    expect(
      parseRosterCustomFieldValue(
        {
          fieldType: "select",
          selectOptions: ["Weekdays", "Weekends"],
        },
        "Flexible",
      ).ok,
    ).toBe(false);
  });
});
