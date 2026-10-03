export type ImportHistoryScalar =
  | string
  | number
  | boolean
  | null;

export type RosterImportRunSummary = {
  id: string;
  sourceType: string;
  sourceFilename: string;
  sourceRowCount: number;
  createdCount: number;
  updatedCount: number;
  reactivatedCount: number;
  leftGuildCount: number;
  unchangedCount: number;
  importedByName: string | null;
  appliedAt: string;
};

export type RosterImportChange = {
  id: string;
  characterId: string;
  characterIgn: string;
  changeKind: string;
  changedFields: string[];
  beforeValues: Record<string, ImportHistoryScalar>;
  afterValues: Record<string, ImportHistoryScalar>;
  recordedAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  inactive_reason: "Inactive reason",
  left_guild_at: "Left Guild at",
  source_origin: "Source",
  level: "Level",
  class_name: "Class",
  title: "Title",
  gender: "Gender",
  guild_position: "Guild position",
  gear_score: "Gear score",
  weekly_activity: "Weekly activity",
  weekly_contribution: "Weekly contribution",
  total_contribution: "Total contribution",
  online_status: "Online status",
  designation: "Designation",
  role_label: "Organizer role",
};

export function labelForImportSource(sourceType: string) {
  if (sourceType === "rtnw_csv") return "RTNW CSV";
  if (sourceType === "generic_spreadsheet") return "Spreadsheet";
  return "Roster import";
}

export function labelForImportChange(changeKind: string) {
  if (changeKind === "new") return "New";
  if (changeKind === "update") return "Updated";
  if (changeKind === "reactivate") return "Returning";
  if (changeKind === "left_guild") return "Left Guild";
  return "Changed";
}

export function toneForImportChange(
  changeKind: string,
): "accent" | "success" | "warning" | "neutral" {
  if (changeKind === "new") return "success";
  if (changeKind === "update") return "accent";

  if (
    changeKind === "reactivate" ||
    changeKind === "left_guild"
  ) {
    return "warning";
  }

  return "neutral";
}

export function labelForImportField(field: string) {
  return (
    FIELD_LABELS[field] ??
    field
      .split("_")
      .filter(Boolean)
      .map(
        (part) =>
          part.charAt(0).toLocaleUpperCase() + part.slice(1),
      )
      .join(" ")
  );
}

function titleCaseValue(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toLocaleUpperCase() + part.slice(1),
    )
    .join(" ");
}

export function formatImportTimestampUtc(value: string) {
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

export function formatImportHistoryValue(
  field: string,
  value: ImportHistoryScalar | undefined,
) {
  if (value === null || value === undefined || value === "") {
    return "â€”";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  if (field === "left_guild_at") {
    return formatImportTimestampUtc(value);
  }

  if (field === "source_origin" && value === "rtnw_export") {
    return "RTNW Export";
  }

  if (
    field === "status" ||
    field === "inactive_reason" ||
    field === "source_origin" ||
    field === "designation"
  ) {
    return titleCaseValue(value);
  }

  return value;
}
