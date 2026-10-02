export type ManualCharacterInput = {
  ign: string;
  level: string;
  className: string;
  guildPosition: string;
  gearScore: string;
  designation: string;
  roleLabel: string;
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

export type ParsedCharacterOrganization = {
  status: "active" | "inactive";
  designation: "main" | "sub" | null;
  roleLabel: string | null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

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
  if (
    input.ign.length < 1 ||
    input.ign.length > 80 ||
    input.ign !== input.ign.trim()
  ) {
    return {
      ok: false,
      message:
        "IGN must be 1–80 characters with no surrounding whitespace.",
    };
  }

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

  if (!level.ok) {
    return level;
  }

  if (!className.ok) {
    return className;
  }

  if (!guildPosition.ok) {
    return guildPosition;
  }

  if (!gearScore.ok) {
    return gearScore;
  }

  if (!designation.ok) {
    return designation;
  }

  if (!roleLabel.ok) {
    return roleLabel;
  }

  return {
    ok: true,
    value: {
      ign: input.ign,
      level: level.value,
      className: className.value,
      guildPosition: guildPosition.value,
      gearScore: gearScore.value,
      designation: designation.value,
      roleLabel: roleLabel.value,
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

  if (!designation.ok) {
    return designation;
  }

  if (!roleLabel.ok) {
    return roleLabel;
  }

  return {
    ok: true,
    value: {
      status: input.status,
      designation: designation.value ?? null,
      roleLabel: roleLabel.value ?? null,
    },
  };
}
