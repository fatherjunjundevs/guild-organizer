import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

const headers = [
  "Id",
  "Player",
  "Lv.",
  "Class",
  "Title",
  "Gender",
  "Position",
  "Gear Score",
  "Weekly",
  "Weekly Contribution",
  "Total Contribution",
  "Online Status",
];

function rosterCsv(count: number) {
  const rows = Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    const ign = `PagedCharacter${String(ordinal).padStart(4, "0")}`;

    return [
      String(ordinal),
      ign,
      "90",
      "High Priest",
      "Pagination E2E",
      "F",
      "Member",
      "50000",
      "700",
      "2000",
      "15000",
      "[Online]",
    ];
  });

  return [headers, ...rows]
    .map((values) => values.join(","))
    .join("\r\n");
}

test("large roster renders bounded pages and filter changes reset pagination", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await page.getByRole("button", { name: "Import RTNW CSV" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Sync RTNW Guild Roster",
    });

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "pagination-201.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(rosterCsv(201), "utf8"),
    });

    await dialog
      .getByRole("button", { name: "Confirm roster sync" })
      .click();

    await expect(
      dialog.getByText("Sync complete", { exact: true }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Done" }).click();

    const table = page.getByRole("table");
    const pages = page.getByRole("navigation", {
      name: "Roster pages",
    });

    await expect(pages).toBeVisible();
    await expect(pages.getByText("Page 1 of 2")).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(200);

    await pages.getByRole("button", { name: "Next" }).click();

    await expect(pages.getByText("Page 2 of 2")).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(
      table.getByText("PagedCharacter0201", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Search").fill("PagedCharacter0201");

    await expect(pages).toHaveCount(0);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(
      page.getByText(/Showing\s+1\s+of\s+201\s+stored characters/),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
