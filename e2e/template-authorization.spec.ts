import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedRoleFixture } from "./helpers/local-supabase";

test("member cannot enter Template management", async ({ page, context }) => {
  const fixture = await createAuthenticatedRoleFixture(context, { role: "member" });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/templates`);
    await expect(page).not.toHaveURL(new RegExp(`/app/guild/${fixture.guildId}/templates$`));
    await expect(
      page.getByRole("heading", { level: 1, name: "Event Templates" }),
    ).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("officer without templates.manage sees the restricted state", async ({ page, context }) => {
  const fixture = await createAuthenticatedRoleFixture(context, { role: "officer" });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/templates`);
    await expect(page.getByText("Templates restricted", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Template management is not enabled", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Manage Event Types" }),
    ).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("officer with templates.manage can open Template management", async ({ page, context }) => {
  const fixture = await createAuthenticatedRoleFixture(context, {
    role: "officer",
    capabilities: ["templates.manage"],
  });

  try {
    await page.goto(`/app/guild/${fixture.guildId}/templates`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Event Templates" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Manage Event Types" }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
