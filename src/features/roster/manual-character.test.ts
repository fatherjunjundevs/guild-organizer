import { describe, expect, it } from "vitest";
import {
  parseCharacterOrganizationInput,
  parseManualCharacterInput,
} from "@/features/roster/manual-character";

describe("manual roster character input", () => {
  it("preserves an exact Unicode IGN", () => {
    const result = parseManualCharacterInput({
      ign: "焱｜FatherJunJun",
      level: "82",
      className: "High Priest",
      guildPosition: "Elite",
      gearScore: "55000",
      designation: "main",
      roleLabel: "Healer",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ign: "焱｜FatherJunJun",
        level: 82,
        className: "High Priest",
        guildPosition: "Elite",
        gearScore: 55000,
        designation: "main",
        roleLabel: "Healer",
      },
    });
  });

  it("rejects surrounding IGN whitespace instead of changing identity", () => {
    const result = parseManualCharacterInput({
      ign: " FatherJunJun ",
      level: "",
      className: "",
      guildPosition: "",
      gearScore: "",
      designation: "",
      roleLabel: "",
    });

    expect(result.ok).toBe(false);
  });

  it("keeps optional game fields absent when left blank", () => {
    const result = parseManualCharacterInput({
      ign: "ManualCharacter",
      level: "",
      className: " ",
      guildPosition: "",
      gearScore: "",
      designation: "",
      roleLabel: "",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ign: "ManualCharacter",
        level: undefined,
        className: undefined,
        guildPosition: undefined,
        gearScore: undefined,
        designation: undefined,
        roleLabel: undefined,
      },
    });
  });

  it("rejects negative and decimal numeric values", () => {
    const negative = parseManualCharacterInput({
      ign: "ManualCharacter",
      level: "-1",
      className: "",
      guildPosition: "",
      gearScore: "",
      designation: "",
      roleLabel: "",
    });
    const decimal = parseManualCharacterInput({
      ign: "ManualCharacter",
      level: "82.5",
      className: "",
      guildPosition: "",
      gearScore: "",
      designation: "",
      roleLabel: "",
    });

    expect(negative.ok).toBe(false);
    expect(decimal.ok).toBe(false);
  });

  it("accepts Main and Sub designations", () => {
    const main = parseManualCharacterInput({
      ign: "MainChar",
      level: "",
      className: "",
      guildPosition: "",
      gearScore: "",
      designation: "main",
      roleLabel: "",
    });
    const sub = parseManualCharacterInput({
      ign: "SubChar",
      level: "",
      className: "",
      guildPosition: "",
      gearScore: "",
      designation: "sub",
      roleLabel: "",
    });

    expect(main.ok && main.value.designation).toBe("main");
    expect(sub.ok && sub.value.designation).toBe("sub");
  });
});

describe("character organizer input", () => {
  it("clears designation and role with blank values", () => {
    expect(
      parseCharacterOrganizationInput({
        status: "active",
        designation: "",
        roleLabel: " ",
      }),
    ).toEqual({
      ok: true,
      value: {
        status: "active",
        designation: null,
        roleLabel: null,
      },
    });
  });

  it("supports manually inactive state", () => {
    expect(
      parseCharacterOrganizationInput({
        status: "inactive",
        designation: "sub",
        roleLabel: "Reserve healer",
      }),
    ).toEqual({
      ok: true,
      value: {
        status: "inactive",
        designation: "sub",
        roleLabel: "Reserve healer",
      },
    });
  });

  it("rejects unsupported lifecycle states", () => {
    expect(
      parseCharacterOrganizationInput({
        status: "left_guild",
        designation: "",
        roleLabel: "",
      }).ok,
    ).toBe(false);
  });
});
