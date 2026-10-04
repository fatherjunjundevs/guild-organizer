import { describe, expect, it } from "vitest";
import {
  buildTemplateStructureTree,
  moveOrderedId,
  reorderOrderedIdsToTarget,
  parseTeamPartyCount,
  parseTemplateSlotRoleLabel,
  parseTemplateStructureName,
} from "@/features/templates/template-structure";

describe("Template structure input", () => {
  it("trims organizer-entered structure names", () => {
    expect(parseTemplateStructureName("  Alpha  ", "Team")).toEqual({
      ok: true,
      value: "Alpha",
    });
  });

  it("preserves Unicode structure names", () => {
    expect(parseTemplateStructureName("  月 Team  ", "Team")).toEqual({
      ok: true,
      value: "月 Team",
    });
  });

  it("rejects empty and overlong structure names", () => {
    expect(parseTemplateStructureName("   ", "Team").ok).toBe(false);
    expect(
      parseTemplateStructureName("x".repeat(81), "Team").ok,
    ).toBe(false);
  });

  it("normalizes a blank Slot role requirement to null", () => {
    expect(parseTemplateSlotRoleLabel("   ")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("trims a custom Slot role requirement", () => {
    expect(parseTemplateSlotRoleLabel("  Main Tank  ")).toEqual({
      ok: true,
      value: "Main Tank",
    });
  });

  it("rejects an overlong Slot role requirement", () => {
    expect(parseTemplateSlotRoleLabel("x".repeat(81)).ok).toBe(false);
  });

  it("accepts Team party counts from 1 through 8", () => {
    expect(parseTeamPartyCount("1")).toEqual({ ok: true, value: 1 });
    expect(parseTeamPartyCount("8")).toEqual({ ok: true, value: 8 });
  });

  it("rejects Team party counts outside 1 through 8", () => {
    expect(parseTeamPartyCount("0").ok).toBe(false);
    expect(parseTeamPartyCount("9").ok).toBe(false);
    expect(parseTeamPartyCount("4.5").ok).toBe(false);
  });
});

describe("Template ordering helpers", () => {
  it("moves an item one position in either direction", () => {
    expect(moveOrderedId(["A", "B", "C"], "B", -1)).toEqual([
      "B",
      "A",
      "C",
    ]);
    expect(moveOrderedId(["A", "B", "C"], "B", 1)).toEqual([
      "A",
      "C",
      "B",
    ]);
  });

  it("leaves boundary and unknown moves unchanged", () => {
    expect(moveOrderedId(["A", "B"], "A", -1)).toEqual(["A", "B"]);
    expect(moveOrderedId(["A", "B"], "B", 1)).toEqual(["A", "B"]);
    expect(moveOrderedId(["A", "B"], "X", 1)).toEqual(["A", "B"]);
  });

  it("moves a dragged item to the target position", () => {
    expect(
      reorderOrderedIdsToTarget(["A", "B", "C", "D"], "A", "D"),
    ).toEqual(["B", "C", "D", "A"]);

    expect(
      reorderOrderedIdsToTarget(["A", "B", "C", "D"], "D", "A"),
    ).toEqual(["D", "A", "B", "C"]);
  });

  it("leaves invalid or same-target drags unchanged", () => {
    expect(
      reorderOrderedIdsToTarget(["A", "B"], "A", "A"),
    ).toEqual(["A", "B"]);
    expect(
      reorderOrderedIdsToTarget(["A", "B"], "X", "A"),
    ).toEqual(["A", "B"]);
  });
});

describe("Template structure tree", () => {
  it("nests Areas, Teams, Parties, and Slots in deterministic order", () => {
    const tree = buildTemplateStructureTree(
      [
        { id: "area-b", name: "Moon", sortOrder: 1 },
        { id: "area-a", name: "Sun", sortOrder: 0 },
      ],
      [
        {
          id: "section-b",
          areaId: "area-a",
          name: "Team B",
          sortOrder: 1,
        },
        {
          id: "section-a",
          areaId: "area-a",
          name: "Team A",
          sortOrder: 0,
        },
      ],
      [
        {
          id: "party-b",
          sectionId: "section-a",
          name: "Party 2",
          sortOrder: 1,
        },
        {
          id: "party-a",
          sectionId: "section-a",
          name: "Party 1",
          sortOrder: 0,
        },
      ],
      [
        {
          id: "slot-b",
          partyId: "party-a",
          name: "Seat 2",
          roleLabel: null,
          sortOrder: 1,
        },
        {
          id: "slot-a",
          partyId: "party-a",
          name: "Seat 1",
          roleLabel: "Tank",
          sortOrder: 0,
        },
      ],
    );

    expect(tree.areas.map((area) => area.name)).toEqual([
      "Sun",
      "Moon",
    ]);
    expect(tree.areas[0]?.sections.map((section) => section.name)).toEqual([
      "Team A",
      "Team B",
    ]);
    expect(
      tree.areas[0]?.sections[0]?.parties.map((party) => party.name),
    ).toEqual(["Party 1", "Party 2"]);
    expect(
      tree.areas[0]?.sections[0]?.parties[0]?.slots.map(
        (slot) => slot.name,
      ),
    ).toEqual(["Seat 1", "Seat 2"]);
  });

  it("keeps flat Template Teams at the root", () => {
    const tree = buildTemplateStructureTree(
      [],
      [
        {
          id: "section-1",
          areaId: null,
          name: "SUN",
          sortOrder: 0,
        },
      ],
      [],
      [],
    );

    expect(tree.areas).toEqual([]);
    expect(tree.rootSections).toHaveLength(1);
    expect(tree.rootSections[0]?.name).toBe("SUN");
  });
});
