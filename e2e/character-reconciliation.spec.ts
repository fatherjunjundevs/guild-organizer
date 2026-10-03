import { expect, test } from "@playwright/test";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

async function addCharacter(
  page: import("@playwright/test").Page,
  ign: string,
) {
  await page.getByRole("button", { name: "Add Character" }).click();

  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("IGN", { exact: true }).fill(ign);
  await dialog.getByRole("button", { name: "Add Character" }).click();

  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(ign, { exact: true }).first(),
  ).toBeVisible();
}

test("owner explicitly reconciles a source identity into a canonical target", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await addCharacter(page, "OldIdentityE2E");
    await addCharacter(page, "CanonicalIdentityE2E");

    await page
      .getByRole("button", { name: "Reconcile Characters" })
      .click();

    const dialog = page.locator("dialog[open]");

    await dialog
      .getByLabel("Source · becomes historical")
      .selectOption({ label: "OldIdentityE2E · Active" });
    await dialog
      .getByLabel("Target · remains canonical")
      .selectOption({ label: "CanonicalIdentityE2E · Active" });

    await expect(
      dialog.getByText("The selected source is currently Active", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Organizer metadata is conflict-free", {
        exact: true,
      }),
    ).toBeVisible();

    const confirm = dialog.getByRole("checkbox");
    const reconcile = dialog.getByRole("button", {
      name: "Reconcile Characters",
    });

    await expect(reconcile).toBeDisabled();
    await confirm.check();
    await expect(reconcile).toBeEnabled();

    await reconcile.click();

    await expect(
      dialog.getByText("Reconciliation complete", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("OldIdentityE2E", { exact: false }).last(),
    ).toBeVisible();
    await expect(
      dialog.getByText("CanonicalIdentityE2E", {
        exact: false,
      }).last(),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();

    await page.getByLabel("Status").selectOption("reconciled");
    await expect(
      page.getByText("OldIdentityE2E", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("table")
        .getByText(
          "Historical identity → CanonicalIdentityE2E",
          { exact: true },
        ),
    ).toBeVisible();
    await expect(
      page.getByText("History only", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Reconcile Characters" }),
    ).toBeDisabled();
  } finally {
    await fixture.cleanup();
  }
});
