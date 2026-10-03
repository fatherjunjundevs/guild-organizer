export type ManualCharacterInput = {
  ign: string;
  level: string;
  className: string;
  guildPosition: string;
  gearScore: string;
  designation: string;
  roleLabel: string;
};

export type ManualCharacterDetailsInput = {
  ign: string;
  level: string;
  className: string;
  title: string;
  gender: string;
  guildPosition: string;
  gearScore: string;
  weeklyActivity: string;
  weeklyContribution: string;
  totalContribution: string;
  onlineStatus: string;
};

export type CharacterOrganizationInput = {
  status: string;
  designation: string;
  roleLabel: string;
};

export type ParsedManualCharacter = {
  ign: string;
  level?: number;
  className?: string;
  guildPosition?: string;
  gearScore?: number;
  designation?: "main" | "sub";
  roleLabel?: string;
};

export type ParsedManualCharacterDetails = {
  ign: string;
  level: number | null;
  className: string | null;
  title: string | null;
  gender: string | null;
  guildPosition: string | null;
  gearScore: number | null;
  weeklyActivity: number | null;
  weeklyContribution: number | null;
  totalContribution: number | null;
  onlineStatus: string | null;
};

export type ParsedCharacterOrganization = {
  status: "active" | "inactive";
  designation: "main" | "sub" | null;
  roleLabel: string | null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function parseExactIgn(value: string): ParseResult<string> {
  if (
    value.length < 1 ||
    value.length > 80 ||
    value !== value.trim()
  ) {
    return {
      ok: false,
      message:
        "IGN must be 1–80 characters with no surrounding whitespace.",
    };
  }

  return { ok: true, value };
}

function optionalTrimmedText(
  value: string,
  label: string,
  maxLength: number,
): ParseResult<string | undefined> {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      message: `${label} must be ${maxLength} characters or fewer.`,
    };
  }

  return { ok: true, value: trimmed };
}

function optionalNonnegativeInteger(
  value: string,
  label: string,
): ParseResult<number | undefined> {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      message: `${label} must be a nonnegative whole number.`,
    };
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed)) {
    return {
      ok: false,
      message: `${label} is too large.`,
    };
  }

  return { ok: true, value: parsed };
}

function parseDesignation(
  value: string,
): ParseResult<"main" | "sub" | undefined> {
  if (!value) {
    return { ok: true, value: undefined };
  }

  if (value === "main" || value === "sub") {
    return { ok: true, value };
  }

  return {
    ok: false,
    message: "Designation must be Main, Sub, or None.",
  };
}

export function parseManualCharacterInput(
  input: ManualCharacterInput,
): ParseResult<ParsedManualCharacter> {
  const ign = parseExactIgn(input.ign);
  const level = optionalNonnegativeInteger(input.level, "Level");
  const className = optionalTrimmedText(
    input.className,
    "Class",
    80,
  );
  const guildPosition = optionalTrimmedText(
    input.guildPosition,
    "Guild position",
    80,
  );
  const gearScore = optionalNonnegativeInteger(
    input.gearScore,
    "Gear Score",
  );
  const designation = parseDesignation(input.designation);
  const roleLabel = optionalTrimmedText(
    input.roleLabel,
    "Organizer role",
    80,
  );

  if (!ign.ok) return ign;
  if (!level.ok) return level;
  if (!className.ok) return className;
  if (!guildPosition.ok) return guildPosition;
  if (!gearScore.ok) return gearScore;
  if (!designation.ok) return designation;
  if (!roleLabel.ok) return roleLabel;

  return {
    ok: true,
    value: {
      ign: ign.value,
      level: level.value,
      className: className.value,
      guildPosition: guildPosition.value,
      gearScore: gearScore.value,
      designation: designation.value,
      roleLabel: roleLabel.value,
    },
  };
}

export function parseManualCharacterDetailsInput(
  input: ManualCharacterDetailsInput,
): ParseResult<ParsedManualCharacterDetails> {
  const ign = parseExactIgn(input.ign);
  const level = optionalNonnegativeInteger(input.level, "Level");
  const className = optionalTrimmedText(input.className, "Class", 80);
  const title = optionalTrimmedText(input.title, "Title", 120);
  const gender = optionalTrimmedText(input.gender, "Gender", 40);
  const guildPosition = optionalTrimmedText(
    input.guildPosition,
    "Guild position",
    80,
  );
  const gearScore = optionalNonnegativeInteger(
    input.gearScore,
    "Gear Score",
  );
  const weeklyActivity = optionalNonnegativeInteger(
    input.weeklyActivity,
    "Weekly activity",
  );
  const weeklyContribution = optionalNonnegativeInteger(
    input.weeklyContribution,
    "Weekly contribution",
  );
  const totalContribution = optionalNonnegativeInteger(
    input.totalContribution,
    "Total contribution",
  );
  const onlineStatus = optionalTrimmedText(
    input.onlineStatus,
    "Online status",
    120,
  );

  if (!ign.ok) return ign;
  if (!level.ok) return level;
  if (!className.ok) return className;
  if (!title.ok) return title;
  if (!gender.ok) return gender;
  if (!guildPosition.ok) return guildPosition;
  if (!gearScore.ok) return gearScore;
  if (!weeklyActivity.ok) return weeklyActivity;
  if (!weeklyContribution.ok) return weeklyContribution;
  if (!totalContribution.ok) return totalContribution;
  if (!onlineStatus.ok) return onlineStatus;

  return {
    ok: true,
    value: {
      ign: ign.value,
      level: level.value ?? null,
      className: className.value ?? null,
      title: title.value ?? null,
      gender: gender.value ?? null,
      guildPosition: guildPosition.value ?? null,
      gearScore: gearScore.value ?? null,
      weeklyActivity: weeklyActivity.value ?? null,
      weeklyContribution: weeklyContribution.value ?? null,
      totalContribution: totalContribution.value ?? null,
      onlineStatus: onlineStatus.value ?? null,
    },
  };
}

export function parseCharacterOrganizationInput(
  input: CharacterOrganizationInput,
): ParseResult<ParsedCharacterOrganization> {
  if (input.status !== "active" && input.status !== "inactive") {
    return {
      ok: false,
      message: "Status must be Active or Inactive.",
    };
  }

  const designation = parseDesignation(input.designation);
  const roleLabel = optionalTrimmedText(
    input.roleLabel,
    "Organizer role",
    80,
  );

  if (!designation.ok) return designation;
  if (!roleLabel.ok) return roleLabel;

  return {
    ok: true,
    value: {
      status: input.status,
      designation: designation.value ?? null,
      roleLabel: roleLabel.value ?? null,
    },
  };
}
