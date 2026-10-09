import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedRoleFixture } from "./helpers/local-supabase";

test("member cannot enter the management roster", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedRoleFixture(context, {
    role: "member",
  });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(page).not.toHaveURL(
      new RegExp(`/app/guild/${fixture.guildId}/roster$`),
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Guild Roster" }),
    ).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("officer without roster.manage sees the restricted state", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedRoleFixture(context, {
    role: "officer",
  });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(
      page.getByText("Roster restricted", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Roster access is not enabled", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Character" }),
    ).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("officer with roster.manage can open the Master Roster", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedRoleFixture(context, {
    role: "officer",
    capabilities: ["roster.manage"],
  });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Guild Roster" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Character" }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
