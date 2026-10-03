import { expect, test } from "@playwright/test";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

async function addCharacter(
  page: import("@playwright/test").Page,
  ign: string,
) {
  await page.getByRole("button", { name: "Add Character" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Add Guild Character",
  });

  await expect(dialog).toBeVisible();
  await dialog.getByLabel("IGN", { exact: true }).fill(ign);
  await dialog.getByRole("button", { name: "Add Character" }).click();

  await expect(dialog).not.toBeVisible();
  await expect(
    page
      .getByText(ign, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
}

test("Master Roster remains usable at a mobile viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Guild Roster" }),
    ).toBeVisible();

    await addCharacter(page, "ResponsiveMobileE2E");

    await expect(page.locator("table")).toBeHidden();

    await page
      .getByRole("button", { name: "Manage Tags", exact: true })
      .click();

    const tagsDialog = page.getByRole("dialog", {
      name: "Roster Tags",
    });

    await expect(tagsDialog).toBeVisible();
    await expect(tagsDialog.getByRole("button", { name: "Close" })).toBeVisible();
    await tagsDialog.getByRole("button", { name: "Close" }).click();
    await expect(tagsDialog).not.toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test("Master Roster remains usable at a tablet viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Guild Roster" }),
    ).toBeVisible();

    await addCharacter(page, "ResponsiveTabletE2E");

    await expect(page.locator("table")).toBeHidden();

    await page.getByRole("button", { name: "Manage Fields" }).click();

    const fieldsDialog = page.getByRole("dialog", {
      name: "Custom Fields",
    });

    await expect(fieldsDialog).toBeVisible();
    await fieldsDialog.getByRole("button", { name: "Close" }).click();
    await expect(fieldsDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Import RTNW CSV" }).click();

    const importDialog = page.getByRole("dialog", {
      name: "Sync RTNW Guild Roster",
    });

    await expect(importDialog).toBeVisible();
    await importDialog
      .getByRole("button", { name: "Close roster import" })
      .click();
    await expect(importDialog).not.toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
