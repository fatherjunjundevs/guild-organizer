import { describe, expect, it } from "vitest";
import {
  getGuildDestination,
  isGuildRole,
} from "@/features/guilds/routing";

describe("guild routing", () => {
  it("sends owners to management", () => {
    expect(getGuildDestination("guild-1", "owner")).toBe(
      "/app/guild/guild-1/dashboard",
    );
  });

  it("sends admins and officers to management", () => {
    expect(getGuildDestination("guild-1", "admin")).toBe(
      "/app/guild/guild-1/dashboard",
    );
    expect(getGuildDestination("guild-1", "officer")).toBe(
      "/app/guild/guild-1/dashboard",
    );
  });

  it("sends members to the member experience", () => {
    expect(getGuildDestination("guild-1", "member")).toBe(
      "/member/guild/guild-1/home",
    );
  });

  it("validates supported Guild roles", () => {
    expect(isGuildRole("owner")).toBe(true);
    expect(isGuildRole("member")).toBe(true);
    expect(isGuildRole("Owner")).toBe(false);
    expect(isGuildRole("guest")).toBe(false);
  });
});
