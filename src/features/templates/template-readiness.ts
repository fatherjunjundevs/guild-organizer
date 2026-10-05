export type TemplateValidationIssue = {
  issueCode: string;
  severity: string;
  message: string;
  entityType: string;
  entityId: string;
};

export type TemplatePreviewRpcRow = {
  event_type_id: string;
  event_type_name: string;
  template_id: string;
  template_name: string;
  template_description: string | null;
  template_status: string;
  uses_areas: boolean;
  area_id: string | null;
  area_name: string | null;
  area_sort_order: number | null;
  section_id: string | null;
  section_name: string | null;
  section_sort_order: number | null;
  party_id: string | null;
  party_name: string | null;
  party_sort_order: number | null;
  slot_id: string | null;
  slot_name: string | null;
  role_label: string | null;
  slot_sort_order: number | null;
};

export type TemplatePreviewSlot = {
  id: string;
  name: string;
  roleLabel: string | null;
  sortOrder: number;
};

export type TemplatePreviewParty = {
  id: string;
  name: string;
  sortOrder: number;
  slots: TemplatePreviewSlot[];
};

export type TemplatePreviewTeam = {
  id: string;
  name: string;
  sortOrder: number;
  parties: TemplatePreviewParty[];
};

export type TemplatePreviewArea = {
  id: string;
  name: string;
  sortOrder: number;
  teams: TemplatePreviewTeam[];
};

export type TemplatePreviewModel = {
  eventTypeId: string;
  eventTypeName: string;
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  templateStatus: string;
  usesAreas: boolean;
  areas: TemplatePreviewArea[];
  rootTeams: TemplatePreviewTeam[];
};

export type EventTemplateInspection = {
  issues: TemplateValidationIssue[];
  preview: TemplatePreviewModel;
};

export function hasBlockingValidationIssues(
  issues: TemplateValidationIssue[],
) {
  return issues.some((issue) => issue.severity === "error");
}

function numericOrder(value: number | null) {
  return value ?? 0;
}

function compareOrdered(
  left: { sortOrder: number; id: string },
  right: { sortOrder: number; id: string },
) {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

export function buildTemplatePreviewModel(
  rows: TemplatePreviewRpcRow[],
): TemplatePreviewModel | null {
  const first = rows[0];
  if (!first) return null;

  const areas = new Map<string, TemplatePreviewArea>();
  const teams = new Map<string, TemplatePreviewTeam>();
  const parties = new Map<string, TemplatePreviewParty>();
  const seenSlots = new Set<string>();
  const rootTeams: TemplatePreviewTeam[] = [];

  for (const row of rows) {
    let area: TemplatePreviewArea | null = null;

    if (row.area_id) {
      area = areas.get(row.area_id) ?? null;
      if (!area) {
        area = {
          id: row.area_id,
          name: row.area_name ?? "Area",
          sortOrder: numericOrder(row.area_sort_order),
          teams: [],
        };
        areas.set(area.id, area);
      }
    }

    if (!row.section_id) continue;

    let team = teams.get(row.section_id);
    if (!team) {
      team = {
        id: row.section_id,
        name: row.section_name ?? "Team",
        sortOrder: numericOrder(row.section_sort_order),
        parties: [],
      };
      teams.set(team.id, team);

      if (area) area.teams.push(team);
      else rootTeams.push(team);
    }

    if (!row.party_id) continue;

    let party = parties.get(row.party_id);
    if (!party) {
      party = {
        id: row.party_id,
        name: row.party_name ?? "Party",
        sortOrder: numericOrder(row.party_sort_order),
        slots: [],
      };
      parties.set(party.id, party);
      team.parties.push(party);
    }

    if (!row.slot_id || seenSlots.has(row.slot_id)) continue;

    seenSlots.add(row.slot_id);
    party.slots.push({
      id: row.slot_id,
      name: row.slot_name ?? "Seat",
      roleLabel: row.role_label,
      sortOrder: numericOrder(row.slot_sort_order),
    });
  }

  const orderedAreas = [...areas.values()].sort(compareOrdered);
  rootTeams.sort(compareOrdered);

  for (const area of orderedAreas) {
    area.teams.sort(compareOrdered);
  }

  for (const team of teams.values()) {
    team.parties.sort(compareOrdered);
  }

  for (const party of parties.values()) {
    party.slots.sort(compareOrdered);
  }

  return {
    eventTypeId: first.event_type_id,
    eventTypeName: first.event_type_name,
    templateId: first.template_id,
    templateName: first.template_name,
    templateDescription: first.template_description,
    templateStatus: first.template_status,
    usesAreas: first.uses_areas,
    areas: orderedAreas,
    rootTeams,
  };
}
