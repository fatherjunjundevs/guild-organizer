import type {
  MasterRosterCharacter,
  MasterRosterCustomField,
} from "@/features/roster/server";

export type CharacterReconciliationHistoryEntry = {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  sourceIgn: string;
  targetIgn: string;
  note: string | null;
  reconciledAt: string;
};

export type CharacterReconciliationConflict = {
  key: string;
  label: string;
  sourceValue: string | number | boolean | null;
  targetValue: string | number | boolean | null;
};

export type CharacterReconciliationTransfer = {
  key: string;
  label: string;
  value: string | number | boolean;
};

export type CharacterReconciliationPreview = {
  conflicts: CharacterReconciliationConflict[];
  transfers: CharacterReconciliationTransfer[];
  sourceIsActive: boolean;
};

export function displayReconciliationValue(
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return value;
}

export function formatReconciliationTimestampUtc(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function buildCharacterReconciliationPreview(
  source: MasterRosterCharacter,
  target: MasterRosterCharacter,
  customFields: MasterRosterCustomField[],
): CharacterReconciliationPreview {
  const conflicts: CharacterReconciliationConflict[] = [];
  const transfers: CharacterReconciliationTransfer[] = [];

  function compareProfileField(
    key: string,
    label: string,
    sourceValue: string | null,
    targetValue: string | null,
  ) {
    if (
      sourceValue !== null &&
      targetValue !== null &&
      sourceValue !== targetValue
    ) {
      conflicts.push({
        key,
        label,
        sourceValue,
        targetValue,
      });
      return;
    }

    if (sourceValue !== null && targetValue === null) {
      transfers.push({
        key,
        label,
        value: sourceValue,
      });
    }
  }

  compareProfileField(
    "designation",
    "Designation",
    source.designation,
    target.designation,
  );
  compareProfileField(
    "role_label",
    "Organizer role",
    source.roleLabel,
    target.roleLabel,
  );

  const targetTagIds = new Set(target.tags.map((tag) => tag.id));

  for (const tag of source.tags) {
    if (!targetTagIds.has(tag.id)) {
      transfers.push({
        key: `tag:${tag.id}`,
        label: "Tag",
        value: tag.name,
      });
    }
  }

  for (const field of customFields) {
    const sourceValue = source.customFieldValues?.[field.id];
    const targetValue = target.customFieldValues?.[field.id];

    if (sourceValue === undefined) {
      continue;
    }

    if (targetValue === undefined) {
      transfers.push({
        key: `custom:${field.id}`,
        label: field.name,
        value: sourceValue,
      });
      continue;
    }

    if (sourceValue !== targetValue) {
      conflicts.push({
        key: `custom:${field.id}`,
        label: field.name,
        sourceValue,
        targetValue,
      });
    }
  }

  return {
    conflicts,
    transfers,
    sourceIsActive: source.status === "active",
  };
}
