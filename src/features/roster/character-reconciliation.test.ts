import { describe, expect, it } from "vitest";
import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";
import {
  buildCharacterReconciliationPreview,
  displayReconciliationValue,
} from "@/features/roster/character-reconciliation";

const customFields: MasterRosterCustomField[] = [
  {
    id: "field-team",
    name: "Event Team",
    fieldType: "select",
    selectOptions: ["Main", "Reserve"],
  },
  {
    id: "field-priority",
    name: "Priority",
    fieldType: "number",
    selectOptions: [],
  },
];

function character(
  overrides: Partial<MasterRosterCharacter>,
): MasterRosterCharacter {
  return {
    id: "source",
    ign: "OldIGN",
    level: 90,
    className: "High Priest",
    title: null,
    gender: null,
    guildPosition: "Member",
    gearScore: 60000,
    weeklyActivity: 100,
    weeklyContribution: 200,
    totalContribution: 300,
    onlineStatus: null,
    status: "inactive",
    inactiveReason: "left_guild",
    leftGuildAt: "2026-10-01T00:00:00Z",
    sourceOrigin: "rtnw_export",
    designation: null,
    roleLabel: null,
    tags: [],
    customFieldValues: {},
    reconciledIntoCharacterId: null,
    reconciledIntoIgn: null,
    reconciledAt: null,
    ...overrides,
  };
}

describe("character reconciliation preview", () => {
  it("detects conflicting organizer profile values", () => {
    const preview = buildCharacterReconciliationPreview(
      character({ designation: "main" }),
      character({
        id: "target",
        ign: "NewIGN",
        designation: "sub",
      }),
      customFields,
    );

    expect(preview.conflicts).toEqual([
      {
        key: "designation",
        label: "Designation",
        sourceValue: "main",
        targetValue: "sub",
      },
    ]);
  });

  it("detects conflicting custom field values", () => {
    const preview = buildCharacterReconciliationPreview(
      character({
        customFieldValues: { "field-team": "Main" },
      }),
      character({
        id: "target",
        ign: "NewIGN",
        customFieldValues: { "field-team": "Reserve" },
      }),
      customFields,
    );

    expect(preview.conflicts[0]).toMatchObject({
      key: "custom:field-team",
      label: "Event Team",
      sourceValue: "Main",
      targetValue: "Reserve",
    });
  });

  it("lists safe metadata, tag, and custom-field transfers", () => {
    const preview = buildCharacterReconciliationPreview(
      character({
        roleLabel: "Healer",
        tags: [{ id: "tag-raid", name: "Raid Team" }],
        customFieldValues: { "field-priority": 2 },
      }),
      character({
        id: "target",
        ign: "NewIGN",
        roleLabel: null,
        tags: [],
        customFieldValues: {},
      }),
      customFields,
    );

    expect(preview.conflicts).toEqual([]);
    expect(preview.transfers).toEqual(
      expect.arrayContaining([
        {
          key: "role_label",
          label: "Organizer role",
          value: "Healer",
        },
        {
          key: "tag:tag-raid",
          label: "Tag",
          value: "Raid Team",
        },
        {
          key: "custom:field-priority",
          label: "Priority",
          value: 2,
        },
      ]),
    );
  });

  it("does not treat equal values or existing tags as conflicts", () => {
    const source = character({
      designation: "main",
      tags: [{ id: "tag-raid", name: "Raid Team" }],
      customFieldValues: { "field-team": "Main" },
    });
    const target = character({
      id: "target",
      ign: "NewIGN",
      designation: "main",
      tags: [{ id: "tag-raid", name: "Raid Team" }],
      customFieldValues: { "field-team": "Main" },
    });

    const preview = buildCharacterReconciliationPreview(
      source,
      target,
      customFields,
    );

    expect(preview.conflicts).toEqual([]);
    expect(preview.transfers).toEqual([]);
  });

  it("flags an active source as an extra confirmation warning", () => {
    const preview = buildCharacterReconciliationPreview(
      character({ status: "active", inactiveReason: null }),
      character({ id: "target", ign: "NewIGN" }),
      customFields,
    );

    expect(preview.sourceIsActive).toBe(true);
  });

  it("formats history values for display", () => {
    expect(displayReconciliationValue(null)).toBe("—");
    expect(displayReconciliationValue(true)).toBe("Yes");
    expect(displayReconciliationValue(120000)).toBe("120,000");
  });
});
