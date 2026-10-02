export const ROSTER_CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "select",
] as const;

export type RosterCustomFieldType =
  (typeof ROSTER_CUSTOM_FIELD_TYPES)[number];

export type RosterCustomFieldDefinitionInput = {
  fieldType: RosterCustomFieldType;
  selectOptions: string[];
};

export type RosterCustomFieldDefinitionLike = {
  fieldType: RosterCustomFieldType;
  selectOptions: string[];
};

export type RosterCustomFieldValue = string | number | boolean;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseRosterCustomFieldName(
  value: unknown,
): ParseResult<string> {
  if (typeof value !== "string") {
    return { ok: false, message: "Custom field name is required." };
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 40) {
    return {
      ok: false,
      message: "Custom field name must be 1 to 40 characters.",
    };
  }

  return { ok: true, value: name };
}

export function parseRosterCustomFieldType(
  value: unknown,
): ParseResult<RosterCustomFieldType> {
  if (
    typeof value !== "string" ||
    !ROSTER_CUSTOM_FIELD_TYPES.includes(
      value as RosterCustomFieldType,
    )
  ) {
    return { ok: false, message: "Choose a valid custom field type." };
  }

  return {
    ok: true,
    value: value as RosterCustomFieldType,
  };
}

export function parseRosterCustomFieldOptions(
  fieldType: RosterCustomFieldType,
  raw: unknown,
): ParseResult<string[]> {
  const text = typeof raw === "string" ? raw : "";

  if (fieldType !== "select") {
    if (text.trim().length > 0) {
      return {
        ok: false,
        message: "Only Choice fields can define options.",
      };
    }

    return { ok: true, value: [] };
  }

  const options = text
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);

  if (options.length < 2 || options.length > 20) {
    return {
      ok: false,
      message: "Choice fields require 2 to 20 options.",
    };
  }

  if (options.some((option) => option.length > 40)) {
    return {
      ok: false,
      message: "Each Choice option must be 1 to 40 characters.",
    };
  }

  const normalized = options.map((option) =>
    option.toLocaleLowerCase(),
  );

  if (new Set(normalized).size !== normalized.length) {
    return {
      ok: false,
      message: "Choice options must be unique.",
    };
  }

  return { ok: true, value: options };
}

export function parseRosterCustomFieldDefinition(
  fieldTypeValue: unknown,
  optionsValue: unknown,
): ParseResult<RosterCustomFieldDefinitionInput> {
  const fieldType = parseRosterCustomFieldType(fieldTypeValue);

  if (!fieldType.ok) {
    return fieldType;
  }

  const selectOptions = parseRosterCustomFieldOptions(
    fieldType.value,
    optionsValue,
  );

  if (!selectOptions.ok) {
    return selectOptions;
  }

  return {
    ok: true,
    value: {
      fieldType: fieldType.value,
      selectOptions: selectOptions.value,
    },
  };
}

export function parseRosterCustomFieldValue(
  definition: RosterCustomFieldDefinitionLike,
  raw: unknown,
): ParseResult<RosterCustomFieldValue | null> {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (value.length === 0) {
    return { ok: true, value: null };
  }

  if (definition.fieldType === "text") {
    if (value.length > 120) {
      return {
        ok: false,
        message: "Text custom field values are limited to 120 characters.",
      };
    }

    return { ok: true, value };
  }

  if (definition.fieldType === "number") {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
      return {
        ok: false,
        message: "Enter a valid number.",
      };
    }

    const numberValue = Number(value);

    if (
      !Number.isFinite(numberValue) ||
      Math.abs(numberValue) > 1_000_000_000_000
    ) {
      return {
        ok: false,
        message: "The number is outside the supported range.",
      };
    }

    return { ok: true, value: numberValue };
  }

  if (definition.fieldType === "boolean") {
    if (value !== "true" && value !== "false") {
      return {
        ok: false,
        message: "Choose Yes, No, or leave the field unset.",
      };
    }

    return { ok: true, value: value === "true" };
  }

  if (!definition.selectOptions.includes(value)) {
    return {
      ok: false,
      message: "Choose one of the configured options.",
    };
  }

  return { ok: true, value };
}
