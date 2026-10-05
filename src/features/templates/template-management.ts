export type EventTypeManagementStatus = "active" | "archived";
export type TemplateManagementStatus = "draft" | "archived";

export type EventTypeManagementInput = {
  name: string;
  description: string;
  status: string;
};

export type TemplateManagementInput = {
  eventTypeId: string;
  name: string;
  description: string;
  usesAreas: string;
  status: string;
};

export type TemplateCloneInput = {
  eventTypeId: string;
  name: string;
  description: string;
};

export type ParsedEventTypeManagementInput = {
  name: string;
  description: string | null;
  status: EventTypeManagementStatus;
};

export type ParsedTemplateManagementInput = {
  eventTypeId: string;
  name: string;
  description: string | null;
  usesAreas: boolean;
  status: TemplateManagementStatus;
};

export type ParsedTemplateCloneInput = {
  eventTypeId: string;
  name: string;
  description: string | null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredTrimmedText(
  value: string,
  label: string,
  maxLength: number,
): ParseResult<string> {
  const trimmed = value.trim();

  if (trimmed.length < 1 || trimmed.length > maxLength) {
    return {
      ok: false,
      message: `${label} must be 1–${maxLength} characters.`,
    };
  }

  return { ok: true, value: trimmed };
}

function optionalTrimmedText(
  value: string,
  label: string,
  maxLength: number,
): ParseResult<string | null> {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      message: `${label} must be ${maxLength} characters or fewer.`,
    };
  }

  return { ok: true, value: trimmed };
}

export function isValidUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseEventTypeManagementInput(
  input: EventTypeManagementInput,
): ParseResult<ParsedEventTypeManagementInput> {
  const name = requiredTrimmedText(input.name, "Event Type name", 80);
  const description = optionalTrimmedText(
    input.description,
    "Event Type description",
    500,
  );

  if (!name.ok) return name;
  if (!description.ok) return description;

  if (input.status !== "active" && input.status !== "archived") {
    return {
      ok: false,
      message: "Event Type status must be Active or Archived.",
    };
  }

  return {
    ok: true,
    value: {
      name: name.value,
      description: description.value,
      status: input.status,
    },
  };
}

export function parseTemplateManagementInput(
  input: TemplateManagementInput,
): ParseResult<ParsedTemplateManagementInput> {
  if (!isValidUuid(input.eventTypeId)) {
    return {
      ok: false,
      message: "Choose a valid Event Type.",
    };
  }

  const name = requiredTrimmedText(input.name, "Template name", 120);
  const description = optionalTrimmedText(
    input.description,
    "Template description",
    1000,
  );

  if (!name.ok) return name;
  if (!description.ok) return description;

  if (input.usesAreas !== "true" && input.usesAreas !== "false") {
    return {
      ok: false,
      message: "Choose a valid Template structure mode.",
    };
  }

  if (input.status !== "draft" && input.status !== "archived") {
    return {
      ok: false,
      message:
        "Template metadata can only be saved as Draft or Archived. Activation uses the validation gate.",
    };
  }

  return {
    ok: true,
    value: {
      eventTypeId: input.eventTypeId,
      name: name.value,
      description: description.value,
      usesAreas: input.usesAreas === "true",
      status: input.status,
    },
  };
}

export function parseTemplateCloneInput(
  input: TemplateCloneInput,
): ParseResult<ParsedTemplateCloneInput> {
  if (!isValidUuid(input.eventTypeId)) {
    return {
      ok: false,
      message: "Choose a valid destination Event Type.",
    };
  }

  const name = requiredTrimmedText(input.name, "Template name", 120);
  const description = optionalTrimmedText(
    input.description,
    "Template description",
    1000,
  );

  if (!name.ok) return name;
  if (!description.ok) return description;

  return {
    ok: true,
    value: {
      eventTypeId: input.eventTypeId,
      name: name.value,
      description: description.value,
    },
  };
}

export function suggestTemplateCloneName(
  sourceName: string,
  existingNames: string[],
) {
  const source = sourceName.trim() || "Template";
  const copyMatch = source.match(/^(.*?)(?:\s+Copy(?:\s+\d+)?)$/i);
  const base = copyMatch?.[1]?.trim() || source;
  const existing = new Set(
    existingNames.map((name) => name.trim().toLocaleLowerCase()),
  );
  let copyNumber = 1;

  while (true) {
    const suffix = copyNumber === 1 ? " Copy" : ` Copy ${copyNumber}`;
    const maxBaseLength = Math.max(1, 120 - suffix.length);
    const candidate = `${base.slice(0, maxBaseLength).trimEnd()}${suffix}`;

    if (!existing.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }

    copyNumber += 1;
  }
}
