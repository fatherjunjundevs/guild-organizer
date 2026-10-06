import type { EventBuilderStructure } from "@/features/events/event-builder";

export type EventBuilderCharacter = {
  id: string;
  ign: string;
  level: number | null;
  className: string | null;
  guildPosition: string | null;
  gearScore: number | null;
  onlineStatus: string | null;
  designation: string | null;
  roleLabel: string | null;
  status: "active" | "inactive";
  assignedSlotIds: string[];
};

export type EventBuilderEvent = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  eventTypeName: string;
  templateName: string;
  usesAreas: boolean;
  createdAt: string;
  updatedAt: string;
  structure: EventBuilderStructure;
  characters: EventBuilderCharacter[];
};

export type EventRosterView = "unassigned" | "eligible";

export function filterEventBuilderCharacters(
  characters: EventBuilderCharacter[],
  query: string,
  view: EventRosterView,
) {
  const normalized = query.trim().toLocaleLowerCase();

  return characters
    .filter((character) => character.status === "active")
    .filter(
      (character) =>
        view !== "unassigned" || character.assignedSlotIds.length === 0,
    )
    .filter((character) => {
      if (!normalized) return true;

      const searchable = [
        character.ign,
        character.className,
        character.guildPosition,
        character.roleLabel,
        character.designation,
        character.level?.toString() ?? null,
        character.gearScore?.toString() ?? null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLocaleLowerCase();

      return searchable.includes(normalized);
    })
    .sort((left, right) =>
      left.ign.localeCompare(right.ign, undefined, { sensitivity: "base" }),
    );
}

export function mapAssignmentsBySlot(
  characters: EventBuilderCharacter[],
) {
  const assignments = new Map<string, EventBuilderCharacter>();

  for (const character of characters) {
    for (const slotId of character.assignedSlotIds) {
      assignments.set(slotId, character);
    }
  }

  return assignments;
}
