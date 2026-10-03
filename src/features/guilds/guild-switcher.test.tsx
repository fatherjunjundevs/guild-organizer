import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { GuildSwitcher } from "@/features/guilds/guild-switcher";
import type { GuildMembershipSummary } from "@/features/guilds/server";

afterEach(() => cleanup());

const memberships: GuildMembershipSummary[] = [
  {
    membershipId: "membership-1",
    guildId: "guild-1",
    guildName: "TEST 1",
    role: "owner",
    destination: "/app/guild/guild-1/dashboard",
  },
];

describe("GuildSwitcher", () => {
  it("closes when the user clicks outside", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <GuildSwitcher
          memberships={memberships}
          currentGuildId="guild-1"
          align="start"
        />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(
      screen.getByRole("button", { name: "Switch Guild" }),
    );

    expect(
      screen.getByRole("menu", { name: "Switch Guild" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Outside" }),
    );

    expect(
      screen.queryByRole("menu", { name: "Switch Guild" }),
    ).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();

    render(
      <GuildSwitcher
        memberships={memberships}
        currentGuildId="guild-1"
        align="start"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Switch Guild",
    });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("menu", { name: "Switch Guild" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
