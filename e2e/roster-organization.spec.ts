import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

test("owner manages manual roster metadata, tags, custom fields, and bulk status", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await page.getByRole("button", { name: "Add Character" }).click();
    let dialog = page.locator("dialog[open]");

    await dialog.getByLabel("IGN", { exact: true }).fill("OrganizerFlowE2E");
    await dialog.getByLabel("Designation").selectOption("main");
    await dialog
      .getByRole("button", { name: "Add Character" })
      .click();

    await expect(dialog).not.toBeVisible();

    await page.getByRole("button", { name: "Manage Tags" }).click();
    dialog = page.locator("dialog[open]");

    await dialog.getByLabel("New tag").fill("Raid Team");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(
      dialog.getByText("Raid Team", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    const row = page
      .getByRole("row")
      .filter({ hasText: "OrganizerFlowE2E" });

    await row
      .getByRole("button", { name: "Manage tags for OrganizerFlowE2E" })
      .click();
    dialog = page.locator("dialog[open]");

    await dialog.getByLabel("Raid Team").check();
    await dialog.getByRole("button", { name: "Save Tags" }).click();

    await expect(
      row.getByText("Raid Team", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Manage Fields" }).click();
    dialog = page.locator("dialog[open]");

    await dialog.getByLabel("Field name").fill("Discord Name");
    await dialog.getByRole("button", { name: "Create Field" }).click();

    await expect(
      dialog.getByText("Discord Name was created.", { exact: true }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Manage Fields" }).click();
    dialog = page.locator("dialog[open]");

    await expect(
      dialog.getByText("Discord Name", { exact: true }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();

    await row
      .getByRole("button", { name: "Edit OrganizerFlowE2E" })
      .click();
    dialog = page.locator("dialog[open]");

    await dialog.getByLabel("Discord Name").fill("organizer-e2e");
    await dialog
      .getByRole("button", { name: "Save Custom Fields" })
      .click();

    await expect(dialog).not.toBeVisible();
    await expect(
      row.getByText("Discord Name: organizer-e2e", {
        exact: true,
      }),
    ).toBeVisible();

    await page
      .getByRole("checkbox", { name: "Select OrganizerFlowE2E" })
      .check();

    await page.getByRole("button", { name: "Bulk Edit" }).click();
    dialog = page.locator("dialog[open]");

    await dialog.getByLabel("Action").selectOption("status");
    await dialog.getByLabel("Roster Status").selectOption("inactive");
    await dialog
      .getByRole("button", { name: "Apply to 1" })
      .click();

    await expect(dialog).not.toBeVisible();

    await page.getByLabel("Status").selectOption("inactive");
    await expect(
      page.getByText("OrganizerFlowE2E", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
