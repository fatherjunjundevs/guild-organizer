import { describe, expect, it } from "vitest";
import type { EventBuilderCharacter } from "@/features/events/event-assignment";
import type { EventBuilderStructure } from "@/features/events/event-builder";
import {
  buildEventBuilderWarningReport,
  groupEventWarningsBySlot,
} from "@/features/events/event-warnings";

const structure: EventBuilderStructure = {
  areas: [],
  rootSections: [
    {
      id: "team-1",
      name: "SUN",
      sortOrder: 0,
      parties: [
        {
          id: "party-1",
          name: "Party 1",
          sortOrder: 0,
          slots: [
            {
              id: "slot-1",
              name: "Seat 1",
              roleLabel: "Tank",
              sortOrder: 0,
            },
            {
              id: "slot-2",
              name: "Seat 2",
              roleLabel: "Healer",
              sortOrder: 1,
            },
          ],
        },
        {
          id: "party-2",
          name: "Party 2",
          sortOrder: 1,
          slots: [
            {
              id: "slot-3",
              name: "Seat 1",
              roleLabel: "Support",
              sortOrder: 0,
            },
            {
              id: "slot-4",
              name: "Seat 2",
              roleLabel: "DPS",
              sortOrder: 1,
            },
            {
              id: "slot-5",
              name: "Seat 3",
              roleLabel: null,
              sortOrder: 2,
            },
          ],
        },
      ],
    },
  ],
  totals: {
    areas: 0,
    sections: 1,
    parties: 2,
    slots: 5,
  },
};

const characters: EventBuilderCharacter[] = [
  {
    id: "alpha",
    ign: "AlphaTank",
    level: 90,
    className: "Knight",
    guildPosition: "Member",
    gearScore: 120000,
    onlineStatus: "Online",
    designation: "main",
    roleLabel: "Tank",
    status: "active",
    assignedSlotIds: ["slot-1", "slot-2"],
  },
  {
    id: "beta",
    ign: "Beta",
    level: 88,
    className: "Bard",
    guildPosition: "Member",
    gearScore: 110000,
    onlineStatus: "Online",
    designation: "main",
    roleLabel: null,
    status: "active",
    assignedSlotIds: ["slot-3"],
  },
  {
    id: "former",
    ign: "FormerMage",
    level: 86,
    className: "Wizard",
    guildPosition: "Member",
    gearScore: 101000,
    onlineStatus: "Offline",
    designation: null,
    roleLabel: "DPS",
    status: "inactive",
    assignedSlotIds: ["slot-5"],
  },
];

describe("Event Builder warning engine", () => {
  it("detects duplicates, missing required roles, role conflicts, and inactive assignments", () => {
    const report = buildEventBuilderWarningReport(structure, characters);

    expect(report.summary).toEqual({
      total: 5,
      duplicates: 1,
      missingRoles: 2,
      roleConflicts: 1,
      inactiveAssignments: 1,
    });

    expect(report.warnings.map((warning) => warning.code)).toEqual([
      "duplicate-character",
      "role-mismatch",
      "role-missing",
      "required-role-open",
      "inactive-character",
    ]);
  });

  it("attaches a duplicate warning to every Seat occupied by that Character", () => {
    const report = buildEventBuilderWarningReport(structure, characters);
    const bySlot = groupEventWarningsBySlot(report.warnings);

    expect(
      bySlot.get("slot-1")?.some(
        (warning) => warning.code === "duplicate-character",
      ),
    ).toBe(true);
    expect(
      bySlot.get("slot-2")?.some(
        (warning) => warning.code === "duplicate-character",
      ),
    ).toBe(true);
  });

  it("reports Full and open Party state from current assignments", () => {
    const report = buildEventBuilderWarningReport(structure, characters);

    expect(report.partyStatuses).toEqual([
      {
        partyId: "party-1",
        totalSeats: 2,
        filledSeats: 2,
        openSeats: 0,
        status: "full",
      },
      {
        partyId: "party-2",
        totalSeats: 3,
        filledSeats: 2,
        openSeats: 1,
        status: "open",
      },
    ]);
  });

  it("matches required roles case-insensitively after trimming", () => {
    const matchingCharacters = characters.map((character) =>
      character.id === "alpha"
        ? {
            ...character,
            roleLabel: "  healer ",
            assignedSlotIds: ["slot-2"],
          }
        : { ...character, assignedSlotIds: [] },
    );

    const report = buildEventBuilderWarningReport(
      structure,
      matchingCharacters,
    );

    expect(
      report.warnings.some(
        (warning) =>
          warning.code === "role-mismatch" &&
          warning.slotIds.includes("slot-2"),
      ),
    ).toBe(false);
  });
});
