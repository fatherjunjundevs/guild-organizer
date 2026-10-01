import type { MasterRosterCharacter } from "@/features/roster/server";

export type RosterStatusFilter =
  | "active"
  | "left"
  | "inactive"
  | "all";

export type RosterSort =
  | "gear-desc"
  | "ign-asc"
  | "level-desc"
  | "contribution-desc";

export type RosterViewOptions = {
  query: string;
  status: RosterStatusFilter;
  className: string;
  sort: RosterSort;
};

function compareNullableNumbersDesc(
  left: number | null,
  right: number | null,
) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

export function getRosterSummary(
  characters: MasterRosterCharacter[],
) {
  let active = 0;
  let left = 0;
  let inactive = 0;

  for (const character of characters) {
    if (character.status === "active") {
      active += 1;
    } else if (character.inactiveReason === "left_guild") {
      left += 1;
    } else {
      inactive += 1;
    }
  }

  return {
    total: characters.length,
    active,
    left,
    inactive,
  };
}

export function getRosterClassOptions(
  characters: MasterRosterCharacter[],
) {
  return Array.from(
    new Set(
      characters
        .map((character) => character.className)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function filterAndSortRoster(
  characters: MasterRosterCharacter[],
  options: RosterViewOptions,
) {
  const query = options.query.trim().toLocaleLowerCase();

  return characters
    .filter((character) => {
      if (options.status === "active" && character.status !== "active") {
        return false;
      }

      if (
        options.status === "left" &&
        character.inactiveReason !== "left_guild"
      ) {
        return false;
      }

      if (
        options.status === "inactive" &&
        (
          character.status !== "inactive" ||
          character.inactiveReason === "left_guild"
        )
      ) {
        return false;
      }

      if (
        options.className !== "all" &&
        character.className !== options.className
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        character.ign,
        character.className,
        character.title,
        character.guildPosition,
        character.roleLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      return searchable.includes(query);
    })
    .sort((left, right) => {
      if (options.sort === "ign-asc") {
        return left.ign.localeCompare(right.ign);
      }

      if (options.sort === "level-desc") {
        return (
          compareNullableNumbersDesc(left.level, right.level) ||
          left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "contribution-desc") {
        return (
          compareNullableNumbersDesc(
            left.totalContribution,
            right.totalContribution,
          ) || left.ign.localeCompare(right.ign)
        );
      }

      return (
        compareNullableNumbersDesc(left.gearScore, right.gearScore) ||
        left.ign.localeCompare(right.ign)
      );
    });
}
