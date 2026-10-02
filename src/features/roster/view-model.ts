import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";

export type RosterStatusFilter =
  | "active"
  | "left"
  | "inactive"
  | "all";

export type RosterSort =
  | "position-hierarchy"
  | "gear-desc"
  | "ign-asc"
  | "level-desc"
  | "weekly-contribution-desc"
  | "weekly-contribution-asc"
  | "total-contribution-desc"
  | "total-contribution-asc";

export type RosterViewOptions = {
  query: string;
  status: RosterStatusFilter;
  className: string;
  tagId?: string;
  customFields?: MasterRosterCustomField[];
  customFieldId?: string;
  customFieldValue?: string;
  sort: RosterSort;
};

const GUILD_POSITION_HIERARCHY: Record<string, number> = {
  emperor: 0,
  chancellor: 1,
  commander: 2,
  duchess: 3,
  warmaster: 4,
  "raid leader": 5,
  elite: 6,
  member: 7,
};

function compareNullableNumbersDesc(
  left: number | null,
  right: number | null,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function compareNullableNumbersAsc(
  left: number | null,
  right: number | null,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function getGuildPositionHierarchyRank(position: string | null) {
  if (!position) return Number.MAX_SAFE_INTEGER;

  return (
    GUILD_POSITION_HIERARCHY[position.trim().toLocaleLowerCase()] ??
    Number.MAX_SAFE_INTEGER
  );
}

export function formatRosterCustomFieldValue(
  value: string | number | boolean,
) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function getCustomFieldSearchTokens(
  character: MasterRosterCharacter,
  fields: MasterRosterCustomField[],
) {
  const values = character.customFieldValues ?? {};
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const tokens: string[] = [];

  for (const [fieldId, value] of Object.entries(values)) {
    const field = fieldsById.get(fieldId);

    if (field) {
      tokens.push(field.name);
    }

    tokens.push(String(value));

    if (typeof value === "boolean") {
      tokens.push(formatRosterCustomFieldValue(value));
    }
  }

  return tokens;
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

      if (
        options.tagId &&
        options.tagId !== "all" &&
        !character.tags.some((tag) => tag.id === options.tagId)
      ) {
        return false;
      }

      if (
        options.customFieldId &&
        options.customFieldId !== "all"
      ) {
        const value =
          character.customFieldValues?.[options.customFieldId];

        if (value === undefined) {
          return false;
        }

        const filterValue = options.customFieldValue?.trim() ?? "";

        if (filterValue) {
          const field = options.customFields?.find(
            (candidate) => candidate.id === options.customFieldId,
          );
          const normalizedValue = String(value).toLocaleLowerCase();
          const normalizedFilter = filterValue.toLocaleLowerCase();

          if (field?.fieldType === "text") {
            if (!normalizedValue.includes(normalizedFilter)) {
              return false;
            }
          } else if (normalizedValue !== normalizedFilter) {
            return false;
          }
        }
      }

      if (!query) return true;

      const searchable = [
        character.ign,
        character.className,
        character.title,
        character.guildPosition,
        character.roleLabel,
        ...character.tags.map((tag) => tag.name),
        ...getCustomFieldSearchTokens(
          character,
          options.customFields ?? [],
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      return searchable.includes(query);
    })
    .sort((left, right) => {
      if (options.sort === "position-hierarchy") {
        return (
          getGuildPositionHierarchyRank(left.guildPosition) -
            getGuildPositionHierarchyRank(right.guildPosition) ||
          compareNullableNumbersDesc(left.gearScore, right.gearScore) ||
          left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "ign-asc") {
        return left.ign.localeCompare(right.ign);
      }

      if (options.sort === "level-desc") {
        return (
          compareNullableNumbersDesc(left.level, right.level) ||
          left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "weekly-contribution-desc") {
        return (
          compareNullableNumbersDesc(
            left.weeklyContribution,
            right.weeklyContribution,
          ) || left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "weekly-contribution-asc") {
        return (
          compareNullableNumbersAsc(
            left.weeklyContribution,
            right.weeklyContribution,
          ) || left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "total-contribution-desc") {
        return (
          compareNullableNumbersDesc(
            left.totalContribution,
            right.totalContribution,
          ) || left.ign.localeCompare(right.ign)
        );
      }

      if (options.sort === "total-contribution-asc") {
        return (
          compareNullableNumbersAsc(
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
