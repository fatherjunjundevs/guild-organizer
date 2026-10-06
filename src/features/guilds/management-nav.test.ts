import { describe, expect, it } from "vitest";
import { isManagementNavItemActive } from "@/features/guilds/management-nav";

describe("isManagementNavItemActive", () => {
  const dashboard = "/app/guild/guild-1/dashboard";
  const events = "/app/guild/guild-1/events";

  it("matches an exact management route", () => {
    expect(isManagementNavItemActive(dashboard, dashboard)).toBe(true);
  });

  it("keeps the parent item active for a nested route", () => {
    expect(
      isManagementNavItemActive(
        "/app/guild/guild-1/events/event-1",
        events,
      ),
    ).toBe(true);
  });

  it("does not match a sibling management route", () => {
    expect(isManagementNavItemActive(dashboard, events)).toBe(false);
  });

  it("does not match a similarly prefixed route segment", () => {
    expect(
      isManagementNavItemActive(
        "/app/guild/guild-1/events-archive",
        events,
      ),
    ).toBe(false);
  });
});
