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


export function applyEventSlotAssignment(
  characters: EventBuilderCharacter[],
  slotId: string,
  characterId: string,
) {
  if (!slotId || !characterId) return characters;

  const selectedCharacter = characters.find(
    (character) => character.id === characterId,
  );

  if (!selectedCharacter) return characters;

  return characters.map((character) => {
    const withoutTargetSlot = character.assignedSlotIds.filter(
      (assignedSlotId) => assignedSlotId !== slotId,
    );

    if (character.id !== characterId) {
      if (withoutTargetSlot.length === character.assignedSlotIds.length) {
        return character;
      }

      return {
        ...character,
        assignedSlotIds: withoutTargetSlot,
      };
    }

    return {
      ...character,
      assignedSlotIds: [...withoutTargetSlot, slotId],
    };
  });
}

export function applyEventSlotClear(
  characters: EventBuilderCharacter[],
  slotId: string,
) {
  if (!slotId) return characters;

  return characters.map((character) => {
    if (!character.assignedSlotIds.includes(slotId)) {
      return character;
    }

    return {
      ...character,
      assignedSlotIds: character.assignedSlotIds.filter(
        (assignedSlotId) => assignedSlotId !== slotId,
      ),
    };
  });
}

export type EventSlotDropMode = "move" | "swap" | "same-character";

export function getEventSlotDropMode(
  sourceCharacterId: string,
  targetCharacterId: string | null,
): EventSlotDropMode {
  if (!targetCharacterId) return "move";
  if (targetCharacterId === sourceCharacterId) return "same-character";
  return "swap";
}

export function applyEventSlotMove(
  characters: EventBuilderCharacter[],
  sourceSlotId: string,
  targetSlotId: string,
) {
  if (!sourceSlotId || !targetSlotId || sourceSlotId === targetSlotId) {
    return characters;
  }

  const sourceCharacter = characters.find((character) =>
    character.assignedSlotIds.includes(sourceSlotId),
  );

  if (!sourceCharacter) return characters;

  const targetCharacter = characters.find((character) =>
    character.assignedSlotIds.includes(targetSlotId),
  );

  if (targetCharacter?.id === sourceCharacter.id) {
    return characters;
  }

  return characters.map((character) => {
    if (character.id === sourceCharacter.id) {
      return {
        ...character,
        assignedSlotIds: character.assignedSlotIds.map((slotId) =>
          slotId === sourceSlotId ? targetSlotId : slotId,
        ),
      };
    }

    if (targetCharacter && character.id === targetCharacter.id) {
      return {
        ...character,
        assignedSlotIds: character.assignedSlotIds.map((slotId) =>
          slotId === targetSlotId ? sourceSlotId : slotId,
        ),
      };
    }

    return character;
  });
}
