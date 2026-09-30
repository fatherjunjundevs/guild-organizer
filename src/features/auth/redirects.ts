export const DEFAULT_AFTER_AUTH_PATH = "/";

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_AFTER_AUTH_PATH,
) {
  if (!value) {
    return fallback;
  }

  try {
    const base = new URL("https://guild-organizer.invalid");
    const candidate = new URL(value, base);

    if (candidate.origin !== base.origin) {
      return fallback;
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}
