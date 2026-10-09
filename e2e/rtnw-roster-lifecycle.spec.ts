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

function row(
  id: number,
  ign: string,
  gearScore: number,
) {
  return [
    String(id),
    ign,
    "90",
    "High Priest",
    "Pathfinder I",
    "F",
    "Member",
    String(gearScore),
    "700",
    "2000",
    "15000",
    "[Online]",
  ];
}

function csv(rows: string[][]) {
  return [headers, ...rows].map((values) => values.join(",")).join("\r\n");
}

async function applyRtnwCsv(
  page: import("@playwright/test").Page,
  filename: string,
  contents: string,
) {
  await page
    .getByRole("button", { name: "Import RTNW CSV" })
    .click();

  const dialog = page.locator("dialog[open]");

  await dialog.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(contents, "utf8"),
  });

  await expect(
    dialog.getByRole("button", { name: "Confirm roster sync" }),
  ).toBeVisible();

  await dialog
    .getByRole("button", { name: "Confirm roster sync" })
    .click();

  await expect(
    dialog.getByText("Sync complete", { exact: true }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).not.toBeVisible();
}

test("owner preserves Left Guild history and reactivates returning exact IGN", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedOwnerFixture(context);

  try {
    await page.goto(`/app/guild/${fixture.guildId}/roster`);

    await applyRtnwCsv(
      page,
      "rtnw-first.csv",
      csv([
        row(1, "LifecycleAlpha", 51000),
        row(2, "LifecycleBeta", 50000),
      ]),
    );

    await expect(
      page.getByText("LifecycleAlpha", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("LifecycleBeta", { exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Import RTNW CSV" })
      .click();

    let dialog = page.locator("dialog[open]");

    await dialog.locator('input[type="file"]').setInputFiles({
      name: "rtnw-departure.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        csv([row(1, "LifecycleAlpha", 52000)]),
        "utf8",
      ),
    });

    await expect(
      dialog.getByText("1 character will be marked Left Guild", {
        exact: false,
      }),
    ).toBeVisible();

    await dialog
      .getByRole("button", { name: "Confirm roster sync" })
      .click();
    await expect(
      dialog.getByText("Sync complete", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();

    await page.getByLabel("Status").selectOption("left");
    await expect(
      page.getByText("LifecycleBeta", { exact: true }).first(),
    ).toBeVisible();

    await applyRtnwCsv(
      page,
      "rtnw-return.csv",
      csv([
        row(1, "LifecycleAlpha", 52000),
        row(2, "LifecycleBeta", 50500),
      ]),
    );

    await page.getByLabel("Status").selectOption("active");
    await expect(
      page.getByText("LifecycleAlpha", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("LifecycleBeta", { exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Import History" })
      .click();

    dialog = page.locator("dialog[open]");

    await expect(
      dialog.getByText("rtnw-first.csv", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("rtnw-departure.csv", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("rtnw-return.csv", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
