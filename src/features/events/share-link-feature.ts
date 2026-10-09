import "server-only";

// Keep unfinished external sharing closed outside explicitly authorized local testing.
export function isShareLinkInterfaceEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.APP_ENV === "local" && env.SHARE_LINK_INTERFACE_ENABLED === "true";
}
