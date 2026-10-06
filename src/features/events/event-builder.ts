export type EventBuilderAreaRow = {
  id: string;
  name: string;
  sort_order: number;
};

export type EventBuilderSectionRow = {
  id: string;
  area_id: string | null;
  name: string;
  sort_order: number;
};

export type EventBuilderPartyRow = {
  id: string;
  section_id: string;
  name: string;
  sort_order: number;
};

export type EventBuilderSlotRow = {
  id: string;
  party_id: string;
  name: string;
  role_label: string | null;
  sort_order: number;
};

export type EventBuilderSlot = {
  id: string;
  name: string;
  roleLabel: string | null;
  sortOrder: number;
};

export type EventBuilderParty = {
  id: string;
  name: string;
  sortOrder: number;
  slots: EventBuilderSlot[];
};

export type EventBuilderSection = {
  id: string;
  name: string;
  sortOrder: number;
  parties: EventBuilderParty[];
};

export type EventBuilderArea = {
  id: string;
  name: string;
  sortOrder: number;
  sections: EventBuilderSection[];
};

export type EventBuilderStructure = {
  areas: EventBuilderArea[];
  rootSections: EventBuilderSection[];
  totals: {
    areas: number;
    sections: number;
    parties: number;
    slots: number;
  };
};

function byOrderThenId<T extends { sort_order: number; id: string }>(
  left: T,
  right: T,
) {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id);
}

export function buildEventBuilderStructure(input: {
  usesAreas: boolean;
  areas: EventBuilderAreaRow[];
  sections: EventBuilderSectionRow[];
  parties: EventBuilderPartyRow[];
  slots: EventBuilderSlotRow[];
}): EventBuilderStructure {
  const sortedSlots = [...input.slots].sort(byOrderThenId);
  const slotsByParty = new Map<string, EventBuilderSlot[]>();

  for (const slot of sortedSlots) {
    const list = slotsByParty.get(slot.party_id) ?? [];
    list.push({
      id: slot.id,
      name: slot.name,
      roleLabel: slot.role_label,
      sortOrder: slot.sort_order,
    });
    slotsByParty.set(slot.party_id, list);
  }

  const sortedParties = [...input.parties].sort(byOrderThenId);
  const partiesBySection = new Map<string, EventBuilderParty[]>();

  for (const party of sortedParties) {
    const list = partiesBySection.get(party.section_id) ?? [];
    list.push({
      id: party.id,
      name: party.name,
      sortOrder: party.sort_order,
      slots: slotsByParty.get(party.id) ?? [],
    });
    partiesBySection.set(party.section_id, list);
  }

  const sortedSections = [...input.sections].sort(byOrderThenId);
  const sectionsByArea = new Map<string, EventBuilderSection[]>();
  const rootSections: EventBuilderSection[] = [];

  for (const section of sortedSections) {
    const built: EventBuilderSection = {
      id: section.id,
      name: section.name,
      sortOrder: section.sort_order,
      parties: partiesBySection.get(section.id) ?? [],
    };

    if (input.usesAreas && section.area_id) {
      const list = sectionsByArea.get(section.area_id) ?? [];
      list.push(built);
      sectionsByArea.set(section.area_id, list);
    } else {
      rootSections.push(built);
    }
  }

  const areas = input.usesAreas
    ? [...input.areas].sort(byOrderThenId).map((area) => ({
        id: area.id,
        name: area.name,
        sortOrder: area.sort_order,
        sections: sectionsByArea.get(area.id) ?? [],
      }))
    : [];

  return {
    areas,
    rootSections,
    totals: {
      areas: input.areas.length,
      sections: input.sections.length,
      parties: input.parties.length,
      slots: input.slots.length,
    },
  };
}
