import { describe, expect, it } from "vitest";
import {
  filterEventBuilderCharacters,
  mapAssignmentsBySlot,
  type EventBuilderCharacter,
} from "@/features/events/event-assignment";

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
    assignedSlotIds: [],
  },
  {
    id: "beta",
    ign: "BetaHeal",
    level: 88,
    className: "Priest",
    guildPosition: "Officer",
    gearScore: 115000,
    onlineStatus: "Offline",
    designation: "sub",
    roleLabel: "Healer",
    status: "active",
    assignedSlotIds: ["slot-2"],
  },
  {
    id: "former",
    ign: "FormerMage",
    level: 85,
    className: "Wizard",
    guildPosition: "Member",
    gearScore: 100000,
    onlineStatus: "Offline",
    designation: null,
    roleLabel: "DPS",
    status: "inactive",
    assignedSlotIds: ["slot-3"],
  },
];

describe("Event Builder assignment roster", () => {
  it("shows only active unassigned Characters in the Unassigned view", () => {
    expect(
      filterEventBuilderCharacters(characters, "", "unassigned").map(
        (character) => character.ign,
      ),
    ).toEqual(["AlphaTank"]);
  });

  it("shows all active Characters in the Eligible view", () => {
    expect(
      filterEventBuilderCharacters(characters, "", "eligible").map(
        (character) => character.ign,
      ),
    ).toEqual(["AlphaTank", "BetaHeal"]);
  });

  it("searches IGN, class, organizer role, and numeric roster fields", () => {
    expect(
      filterEventBuilderCharacters(characters, "priest", "eligible").map(
        (character) => character.ign,
      ),
    ).toEqual(["BetaHeal"]);

    expect(
      filterEventBuilderCharacters(characters, "tank", "eligible").map(
        (character) => character.ign,
      ),
    ).toEqual(["AlphaTank"]);

    expect(
      filterEventBuilderCharacters(characters, "115000", "eligible").map(
        (character) => character.ign,
      ),
    ).toEqual(["BetaHeal"]);
  });

  it("keeps inactive assigned Characters out of new-assignment search", () => {
    expect(
      filterEventBuilderCharacters(characters, "FormerMage", "eligible"),
    ).toEqual([]);
  });

  it("maps current Slot assignments including historical inactive Characters", () => {
    const assignments = mapAssignmentsBySlot(characters);

    expect(assignments.get("slot-2")?.ign).toBe("BetaHeal");
    expect(assignments.get("slot-3")?.ign).toBe("FormerMage");
  });
});
