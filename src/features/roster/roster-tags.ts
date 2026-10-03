export function parseRosterTagName(value: string) {
  const name = value.trim();

  if (name.length < 1 || name.length > 40) {
    return {
      ok: false as const,
      message: "Tag name must be between 1 and 40 characters.",
    };
  }

  return {
    ok: true as const,
    value: name,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRosterTagIds(values: FormDataEntryValue[]) {
  const ids = values.filter(
    (value): value is string => typeof value === "string",
  );
  const uniqueIds = Array.from(new Set(ids));

  if (
    uniqueIds.length > 20 ||
    uniqueIds.some((value) => !UUID_PATTERN.test(value))
  ) {
    return {
      ok: false as const,
      message: "Choose up to 20 valid roster tags.",
    };
  }

  return {
    ok: true as const,
    value: uniqueIds,
  };
}
