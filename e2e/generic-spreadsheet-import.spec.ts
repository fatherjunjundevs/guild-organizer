import { expect, fixtureTest as test } from "./helpers/test";
import ExcelJS from "exceljs-hardened";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

async function buildSpreadsheetBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Roster");

  sheet.addRow([
    "IGN",
    "Class",
    "Gear Score",
    "Designation",
    "Organizer Role",
  ]);
  sheet.addRow([
    "SpreadsheetE2EA",
    "High Priest",
    51000,
    "main",
    "Support",
  ]);
  sheet.addRow([
    "SpreadsheetE2EB",
    "Sniper",
    49000,
    "sub",
    "Ranged DPS",
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("owner previews and applies a mapped XLSX roster import", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Guild Roster" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Import Spreadsheet" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Import Spreadsheet",
    });

    await expect(dialog).toBeVisible();

    const spreadsheet = await buildSpreadsheetBuffer();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "spreadsheet-e2e.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: spreadsheet,
    });

    await expect(dialog.getByText("2 rows ready", { exact: true })).toBeVisible();
    await expect(dialog.getByText("5 mapped", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Preview import" }).click();

    await expect(
      dialog.getByText("SpreadsheetE2EA", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("SpreadsheetE2EB", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm spreadsheet import" }),
    ).toBeVisible();

    const organizerRole = dialog.getByLabel("Organizer Role");
    await organizerRole.selectOption("");

    await expect(dialog.getByText("4 mapped", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm spreadsheet import" }),
    ).toHaveCount(0);

    await organizerRole.selectOption({ label: "5. Organizer Role" });
    await expect(dialog.getByText("5 mapped", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Preview import" }).click();
    await dialog
      .getByRole("button", { name: "Confirm spreadsheet import" })
      .click();

    await expect(
      dialog.getByText("Import complete", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("2 spreadsheet rows were processed.", {
        exact: false,
      }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).not.toBeVisible();

    await expect(
      page.getByText("SpreadsheetE2EA", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("SpreadsheetE2EB", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
