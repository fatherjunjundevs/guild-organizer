import { describe, expect, it } from "vitest";
import { buildEventBuilderStructure } from "@/features/events/event-builder";

describe("buildEventBuilderStructure", () => {
  it("builds an Area-based Event hierarchy in structural order", () => {
    const structure = buildEventBuilderStructure({
      usesAreas: true,
      areas: [
        { id: "area-b", name: "Moon", sort_order: 2 },
        { id: "area-a", name: "Sun", sort_order: 1 },
      ],
      sections: [
        { id: "team-b", area_id: "area-a", name: "Bravo", sort_order: 2 },
        { id: "team-a", area_id: "area-a", name: "Alpha", sort_order: 1 },
        { id: "team-c", area_id: "area-b", name: "Charlie", sort_order: 1 },
      ],
      parties: [
        { id: "party-b", section_id: "team-a", name: "Party 2", sort_order: 2 },
        { id: "party-a", section_id: "team-a", name: "Party 1", sort_order: 1 },
      ],
      slots: [
        {
          id: "slot-b",
          party_id: "party-a",
          name: "Seat 2",
          role_label: "Healer",
          sort_order: 2,
        },
        {
          id: "slot-a",
          party_id: "party-a",
          name: "Seat 1",
          role_label: "Tank",
          sort_order: 1,
        },
      ],
    });

    expect(structure.areas.map((area) => area.name)).toEqual(["Sun", "Moon"]);
    expect(structure.areas[0]?.sections.map((team) => team.name)).toEqual([
      "Alpha",
      "Bravo",
    ]);
    expect(structure.areas[0]?.sections[0]?.parties.map((party) => party.name))
      .toEqual(["Party 1", "Party 2"]);
    expect(
      structure.areas[0]?.sections[0]?.parties[0]?.slots.map(
        (slot) => `${slot.name}:${slot.roleLabel}`,
      ),
    ).toEqual(["Seat 1:Tank", "Seat 2:Healer"]);
    expect(structure.rootSections).toEqual([]);
  });

  it("builds a flat Event with root Teams and no synthetic Areas", () => {
    const structure = buildEventBuilderStructure({
      usesAreas: false,
      areas: [],
      sections: [
        { id: "team-2", area_id: null, name: "Team B", sort_order: 2 },
        { id: "team-1", area_id: null, name: "Team A", sort_order: 1 },
      ],
      parties: [
        { id: "party-1", section_id: "team-1", name: "Party 1", sort_order: 1 },
      ],
      slots: [
        {
          id: "slot-1",
          party_id: "party-1",
          name: "Seat 1",
          role_label: null,
          sort_order: 1,
        },
      ],
    });

    expect(structure.areas).toEqual([]);
    expect(structure.rootSections.map((team) => team.name)).toEqual([
      "Team A",
      "Team B",
    ]);
    expect(structure.rootSections[0]?.parties[0]?.slots[0]?.roleLabel).toBeNull();
  });

  it("reports canonical structural totals independently of rendering mode", () => {
    const structure = buildEventBuilderStructure({
      usesAreas: true,
      areas: [{ id: "area-1", name: "Area", sort_order: 0 }],
      sections: [
        { id: "team-1", area_id: "area-1", name: "Team", sort_order: 0 },
      ],
      parties: [
        { id: "party-1", section_id: "team-1", name: "Party", sort_order: 0 },
      ],
      slots: [
        {
          id: "slot-1",
          party_id: "party-1",
          name: "Seat 1",
          role_label: null,
          sort_order: 0,
        },
        {
          id: "slot-2",
          party_id: "party-1",
          name: "Seat 2",
          role_label: "Support",
          sort_order: 1,
        },
      ],
    });

    expect(structure.totals).toEqual({
      areas: 1,
      sections: 1,
      parties: 1,
      slots: 2,
    });
  });

  it("keeps Parties attached to their own Team", () => {
    const structure = buildEventBuilderStructure({
      usesAreas: false,
      areas: [],
      sections: [
        { id: "team-a", area_id: null, name: "Alpha", sort_order: 0 },
        { id: "team-b", area_id: null, name: "Bravo", sort_order: 1 },
      ],
      parties: [
        { id: "party-b", section_id: "team-b", name: "Bravo Party", sort_order: 0 },
        { id: "party-a", section_id: "team-a", name: "Alpha Party", sort_order: 0 },
      ],
      slots: [],
    });

    expect(structure.rootSections[0]?.parties[0]?.name).toBe("Alpha Party");
    expect(structure.rootSections[1]?.parties[0]?.name).toBe("Bravo Party");
  });
});
