import type { EventBuilderCharacter } from "@/features/events/event-assignment";
import type {
  EventBuilderParty,
  EventBuilderSection,
  EventBuilderStructure,
} from "@/features/events/event-builder";

export type EventBuilderWarningCode =
  | "duplicate-character"
  | "required-role-open"
  | "role-missing"
  | "role-mismatch"
  | "inactive-character";

export type EventBuilderWarning = {
  id: string;
  code: EventBuilderWarningCode;
  title: string;
  message: string;
  location: string;
  slotIds: string[];
  characterId: string | null;
};

export type EventBuilderWarningSummary = {
  total: number;
  duplicates: number;
  missingRoles: number;
  roleConflicts: number;
  inactiveAssignments: number;
};

export type EventBuilderPartyStatus = {
  partyId: string;
  totalSeats: number;
  filledSeats: number;
  openSeats: number;
  status: "full" | "open";
};

export type EventBuilderWarningReport = {
  warnings: EventBuilderWarning[];
  summary: EventBuilderWarningSummary;
  partyStatuses: EventBuilderPartyStatus[];
};

type SlotContext = {
  slotId: string;
  seatName: string;
  roleLabel: string | null;
  partyId: string;
  partyName: string;
  teamName: string;
  areaName: string | null;
};

function normalizeRole(value: string | null) {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized ? normalized : null;
}

function slotLocation(context: SlotContext) {
  return [
    context.areaName,
    context.teamName,
    context.partyName,
    context.seatName,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function collectSectionSlots(
  slots: SlotContext[],
  section: EventBuilderSection,
  areaName: string | null,
) {
  for (const party of section.parties) {
    for (const slot of party.slots) {
      slots.push({
        slotId: slot.id,
        seatName: slot.name,
        roleLabel: slot.roleLabel,
        partyId: party.id,
        partyName: party.name,
        teamName: section.name,
        areaName,
      });
    }
  }
}

function collectSlotContexts(structure: EventBuilderStructure) {
  const slots: SlotContext[] = [];

  for (const area of structure.areas) {
    for (const section of area.sections) {
      collectSectionSlots(slots, section, area.name);
    }
  }

  for (const section of structure.rootSections) {
    collectSectionSlots(slots, section, null);
  }

  return slots;
}

function collectParties(structure: EventBuilderStructure) {
  const parties: EventBuilderParty[] = [];

  for (const area of structure.areas) {
    for (const section of area.sections) {
      parties.push(...section.parties);
    }
  }

  for (const section of structure.rootSections) {
    parties.push(...section.parties);
  }

  return parties;
}

export function groupEventWarningsBySlot(
  warnings: EventBuilderWarning[],
) {
  const grouped = new Map<string, EventBuilderWarning[]>();

  for (const warning of warnings) {
    for (const slotId of warning.slotIds) {
      const list = grouped.get(slotId) ?? [];
      list.push(warning);
      grouped.set(slotId, list);
    }
  }

  return grouped;
}

export function buildEventBuilderWarningReport(
  structure: EventBuilderStructure,
  characters: EventBuilderCharacter[],
): EventBuilderWarningReport {
  const slotContexts = collectSlotContexts(structure);
  const slotById = new Map(
    slotContexts.map((context) => [context.slotId, context]),
  );
  const assignmentBySlot = new Map<string, EventBuilderCharacter>();

  for (const character of characters) {
    for (const slotId of character.assignedSlotIds) {
      if (slotById.has(slotId)) {
        assignmentBySlot.set(slotId, character);
      }
    }
  }

  const warnings: EventBuilderWarning[] = [];

  for (const character of characters) {
    const assignedSlotIds = character.assignedSlotIds.filter((slotId) =>
      slotById.has(slotId),
    );

    if (assignedSlotIds.length <= 1) continue;

    const firstContext = slotById.get(assignedSlotIds[0] ?? "");

    warnings.push({
      id: `duplicate-character:${character.id}`,
      code: "duplicate-character",
      title: "Duplicate assignment",
      message: `${character.ign} is assigned to ${assignedSlotIds.length} Seats in this Event.`,
      location: firstContext
        ? `${slotLocation(firstContext)} + ${assignedSlotIds.length - 1} more`
        : `${assignedSlotIds.length} Event Seats`,
      slotIds: assignedSlotIds,
      characterId: character.id,
    });
  }

  for (const context of slotContexts) {
    const assignment = assignmentBySlot.get(context.slotId);
    const requiredRole = normalizeRole(context.roleLabel);

    if (requiredRole && !assignment) {
      warnings.push({
        id: `required-role-open:${context.slotId}`,
        code: "required-role-open",
        title: "Required role unfilled",
        message: `${context.seatName} requires ${context.roleLabel}, but the Seat is open.`,
        location: slotLocation(context),
        slotIds: [context.slotId],
        characterId: null,
      });
    }

    if (requiredRole && assignment) {
      const characterRole = normalizeRole(assignment.roleLabel);

      if (!characterRole) {
        warnings.push({
          id: `role-missing:${context.slotId}`,
          code: "role-missing",
          title: "Missing Character role",
          message: `${assignment.ign} has no organizer role configured for required ${context.roleLabel}.`,
          location: slotLocation(context),
          slotIds: [context.slotId],
          characterId: assignment.id,
        });
      } else if (characterRole !== requiredRole) {
        warnings.push({
          id: `role-mismatch:${context.slotId}`,
          code: "role-mismatch",
          title: "Role conflict",
          message: `${assignment.ign} is ${assignment.roleLabel}, but this Seat requires ${context.roleLabel}.`,
          location: slotLocation(context),
          slotIds: [context.slotId],
          characterId: assignment.id,
        });
      }
    }

    if (assignment?.status === "inactive") {
      warnings.push({
        id: `inactive-character:${context.slotId}`,
        code: "inactive-character",
        title: "Inactive assignment",
        message: `${assignment.ign} is inactive in the Guild roster but remains assigned here.`,
        location: slotLocation(context),
        slotIds: [context.slotId],
        characterId: assignment.id,
      });
    }
  }

  const partyStatuses = collectParties(structure).map((party) => {
    const filledSeats = party.slots.filter((slot) =>
      assignmentBySlot.has(slot.id),
    ).length;
    const openSeats = party.slots.length - filledSeats;

    return {
      partyId: party.id,
      totalSeats: party.slots.length,
      filledSeats,
      openSeats,
      status: openSeats === 0 ? ("full" as const) : ("open" as const),
    };
  });

  const summary: EventBuilderWarningSummary = {
    total: warnings.length,
    duplicates: warnings.filter(
      (warning) => warning.code === "duplicate-character",
    ).length,
    missingRoles: warnings.filter(
      (warning) =>
        warning.code === "required-role-open" ||
        warning.code === "role-missing",
    ).length,
    roleConflicts: warnings.filter(
      (warning) => warning.code === "role-mismatch",
    ).length,
    inactiveAssignments: warnings.filter(
      (warning) => warning.code === "inactive-character",
    ).length,
  };

  return {
    warnings,
    summary,
    partyStatuses,
  };
}
