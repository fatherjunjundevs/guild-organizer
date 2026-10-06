export type EventCreationInput = {
  templateId: string;
  name: string;
  description: string;
};

export type ParsedEventCreationInput = {
  templateId: string;
  name: string;
  description: string | null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEventUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseEventCreationInput(
  input: EventCreationInput,
): ParseResult<ParsedEventCreationInput> {
  if (!isValidEventUuid(input.templateId)) {
    return { ok: false, message: "Choose a valid active Template." };
  }

  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) {
    return {
      ok: false,
      message: "Event name must be 1–120 characters.",
    };
  }

  const description = input.description.trim();
  if (description.length > 1000) {
    return {
      ok: false,
      message: "Event description must be 1000 characters or fewer.",
    };
  }

  return {
    ok: true,
    value: {
      templateId: input.templateId,
      name,
      description: description || null,
    },
  };
}
