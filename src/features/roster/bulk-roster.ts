export type BulkRosterAction =
  | "designation"
  | "role_label"
  | "status";

export type BulkRosterActionInput = {
  characterIdsJson: string;
  action: string;
  value: string;
};

export type ParsedBulkRosterAction = {
  characterIds: string[];
  action: BulkRosterAction;
  value: string;
};

type ParseResult =
  | { ok: true; value: ParsedBulkRosterAction }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BULK_CHARACTERS = 500;

export function parseBulkRosterActionInput(
  input: BulkRosterActionInput,
): ParseResult {
  let parsedIds: unknown;

  try {
    parsedIds = JSON.parse(input.characterIdsJson);
  } catch {
    return {
      ok: false,
      message: "The selected character list is invalid.",
    };
  }

  if (!Array.isArray(parsedIds)) {
    return {
      ok: false,
      message: "The selected character list is invalid.",
    };
  }

  const uniqueIds = Array.from(new Set(parsedIds));

  if (
    uniqueIds.length < 1 ||
    uniqueIds.length > MAX_BULK_CHARACTERS ||
    uniqueIds.some(
      (value) =>
        typeof value !== "string" || !UUID_PATTERN.test(value),
    )
  ) {
    return {
      ok: false,
      message:
        "Select between 1 and 500 valid Guild characters.",
    };
  }

  if (
    input.action !== "designation" &&
    input.action !== "role_label" &&
    input.action !== "status"
  ) {
    return {
      ok: false,
      message: "Choose a valid bulk roster action.",
    };
  }

  if (input.action === "designation") {
    if (
      input.value !== "" &&
      input.value !== "main" &&
      input.value !== "sub"
    ) {
      return {
        ok: false,
        message: "Designation must be Main, Sub, or None.",
      };
    }

    return {
      ok: true,
      value: {
        characterIds: uniqueIds as string[],
        action: input.action,
        value: input.value,
      },
    };
  }

  if (input.action === "status") {
    if (input.value !== "active" && input.value !== "inactive") {
      return {
        ok: false,
        message: "Status must be Active or Inactive.",
      };
    }

    return {
      ok: true,
      value: {
        characterIds: uniqueIds as string[],
        action: input.action,
        value: input.value,
      },
    };
  }

  const roleLabel = input.value.trim();

  if (roleLabel.length > 80) {
    return {
      ok: false,
      message: "Organizer role must be 80 characters or fewer.",
    };
  }

  return {
    ok: true,
    value: {
      characterIds: uniqueIds as string[],
      action: input.action,
      value: roleLabel,
    },
  };
}
