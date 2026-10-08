import { expect, test } from "@playwright/test";
import { createAuthenticatedEventBuilderFixture } from "./helpers/local-supabase";

async function expectNoDocumentOverflow(
  page: import("@playwright/test").Page,
) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));

  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
}

test("Event Builder remains usable at a mobile viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await createAuthenticatedEventBuilderFixture(context);

  try {
    await page.goto(
      `/app/guild/${fixture.guildId}/events/${fixture.eventId}`,
    );

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "E2E Saturday Siege",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Assignment warnings",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: "Party 1" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: "Party 2" })).toBeVisible();
    await expectNoDocumentOverflow(page);

    const healerSeat = page.locator(
      `[data-event-slot-id="${fixture.slotIds.healerRequired}"]`,
    );

    await healerSeat
      .getByRole("button", { name: "Assign Character" })
      .click();

    const picker = page.getByRole("dialog", {
      name: "Assign Seat 3",
    });

    await expect(picker).toBeVisible();
    await expect(
      picker.getByLabel("Search eligible Characters"),
    ).toBeVisible();
    await expect(
      picker.getByRole("button", {
        name: /^Unassigned \(\d+\)$/,
      }),
    ).toBeVisible();
    await expect(
      picker.getByRole("button", {
        name: /^All eligible \(\d+\)$/,
      }),
    ).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(pickerBox?.width ?? 9999).toBeLessThanOrEqual(390);

    await picker.getByRole("button", { name: "Close" }).click();
    await expect(picker).not.toBeVisible();
    await expectNoDocumentOverflow(page);
  } finally {
    await fixture.cleanup();
  }
});

test("Event Builder keeps board and checks readable at a tablet viewport", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  const fixture = await createAuthenticatedEventBuilderFixture(context);

  try {
    await page.goto(
      `/app/guild/${fixture.guildId}/events/${fixture.eventId}`,
    );

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "E2E Saturday Siege",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("2 warnings", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: "Party 1" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: "Party 2" })).toBeVisible();
    await expect(
      page.getByText("3 Eligible Characters", { exact: false }),
    ).toHaveCount(0);

    await expectNoDocumentOverflow(page);

    const stats = page.getByText("Eligible Characters", {
      exact: true,
    });
    await expect(stats).toBeVisible();
    await expect(
      page.getByText("Filled Seats", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
