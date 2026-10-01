import { describe, expect, it } from "vitest";
import {
  getGuildDestination,
  getGuildExperienceLabel,
  isGuildRole,
  isManagementGuildRole,
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

  it("identifies management roles", () => {
    expect(isManagementGuildRole("owner")).toBe(true);
    expect(isManagementGuildRole("admin")).toBe(true);
    expect(isManagementGuildRole("officer")).toBe(true);
    expect(isManagementGuildRole("member")).toBe(false);
  });

  it("labels the role-aware Guild experience", () => {
    expect(getGuildExperienceLabel("owner")).toBe("Manage");
    expect(getGuildExperienceLabel("admin")).toBe("Manage");
    expect(getGuildExperienceLabel("officer")).toBe("Manage");
    expect(getGuildExperienceLabel("member")).toBe("Member view");
  });

  it("validates supported Guild roles", () => {
    expect(isGuildRole("owner")).toBe(true);
    expect(isGuildRole("member")).toBe(true);
    expect(isGuildRole("Owner")).toBe(false);
    expect(isGuildRole("guest")).toBe(false);
  });
});
