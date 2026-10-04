export const TEAM_MAX_PARTIES = 8;
export const PARTY_SEAT_COUNT = 5;

export type TemplateStructureKind =
  | "area"
  | "section"
  | "party"
  | "slot";

export type TemplateAreaRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type TemplateSectionRow = {
  id: string;
  areaId: string | null;
  name: string;
  sortOrder: number;
};

export type TemplatePartyRow = {
  id: string;
  sectionId: string;
  name: string;
  sortOrder: number;
};

export type TemplateSlotRow = {
  id: string;
  partyId: string;
  name: string;
  roleLabel: string | null;
  sortOrder: number;
};

export type TemplateSlotNode = TemplateSlotRow;

export type TemplatePartyNode = TemplatePartyRow & {
  slots: TemplateSlotNode[];
};

export type TemplateSectionNode = TemplateSectionRow & {
  parties: TemplatePartyNode[];
};

export type TemplateAreaNode = TemplateAreaRow & {
  sections: TemplateSectionNode[];
};

export type TemplateStructureTree = {
  areas: TemplateAreaNode[];
  rootSections: TemplateSectionNode[];
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseTemplateStructureName(
  value: string,
  label: string,
): ParseResult<string> {
  const trimmed = value.trim();

  if (trimmed.length < 1 || trimmed.length > 80) {
    return {
      ok: false,
      message: `${label} name must be 1–80 characters.`,
    };
  }

  return { ok: true, value: trimmed };
}

export function parseTemplateSlotRoleLabel(
  value: string,
): ParseResult<string | null> {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (trimmed.length > 80) {
    return {
      ok: false,
      message: "Role requirement must be 80 characters or fewer.",
    };
  }

  return { ok: true, value: trimmed };
}

export function parseTeamPartyCount(
  value: string,
): ParseResult<number> {
  if (!/^\d+$/.test(value)) {
    return {
      ok: false,
      message: `Party count must be between 1 and ${TEAM_MAX_PARTIES}.`,
    };
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > TEAM_MAX_PARTIES
  ) {
    return {
      ok: false,
      message: `Party count must be between 1 and ${TEAM_MAX_PARTIES}.`,
    };
  }

  return { ok: true, value: parsed };
}

function compareOrdered(
  left: { sortOrder: number; id: string },
  right: { sortOrder: number; id: string },
) {
  return (
    left.sortOrder - right.sortOrder ||
    left.id.localeCompare(right.id)
  );
}

export function buildTemplateStructureTree(
  areas: TemplateAreaRow[],
  sections: TemplateSectionRow[],
  parties: TemplatePartyRow[],
  slots: TemplateSlotRow[],
): TemplateStructureTree {
  const slotsByParty = new Map<string, TemplateSlotNode[]>();

  for (const slot of slots) {
    const partySlots = slotsByParty.get(slot.partyId) ?? [];
    partySlots.push(slot);
    slotsByParty.set(slot.partyId, partySlots);
  }

  for (const partySlots of slotsByParty.values()) {
    partySlots.sort(compareOrdered);
  }

  const partiesBySection = new Map<string, TemplatePartyNode[]>();

  for (const party of parties) {
    const sectionParties = partiesBySection.get(party.sectionId) ?? [];
    sectionParties.push({
      ...party,
      slots: slotsByParty.get(party.id) ?? [],
    });
    partiesBySection.set(party.sectionId, sectionParties);
  }

  for (const sectionParties of partiesBySection.values()) {
    sectionParties.sort(compareOrdered);
  }

  const sectionNodes = sections
    .map((section) => ({
      ...section,
      parties: partiesBySection.get(section.id) ?? [],
    }))
    .sort(compareOrdered);

  const sectionsByArea = new Map<string, TemplateSectionNode[]>();
  const rootSections: TemplateSectionNode[] = [];

  for (const section of sectionNodes) {
    if (!section.areaId) {
      rootSections.push(section);
      continue;
    }

    const areaSections = sectionsByArea.get(section.areaId) ?? [];
    areaSections.push(section);
    sectionsByArea.set(section.areaId, areaSections);
  }

  const areaNodes = areas
    .map((area) => ({
      ...area,
      sections: sectionsByArea.get(area.id) ?? [],
    }))
    .sort(compareOrdered);

  return {
    areas: areaNodes,
    rootSections,
  };
}
