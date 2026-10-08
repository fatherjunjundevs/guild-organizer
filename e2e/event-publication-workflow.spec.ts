import { expect, test } from "@playwright/test";
import { createAuthenticatedEventBuilderFixture } from "./helpers/local-supabase";

test("Organizer previews, publishes, updates, and unpublishes Event versions", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedEventBuilderFixture(context);

  try {
    await page.goto(
      `/app/guild/${fixture.guildId}/events/${fixture.eventId}`,
    );

    await expect(
      page.getByText("Draft only", { exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Preview & publish" })
      .click();

    const preview = page.getByRole("dialog", {
      name: "Member lineup preview",
    });

    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("E2EAlphaTank", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      preview.getByText("Next version v1", { exact: true }),
    ).toBeVisible();

    await preview
      .getByRole("button", { name: "Publish v1" })
      .click();

    await expect(preview).not.toBeVisible();
    await expect(
      page.getByText("Published v1", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Published version 1.", { exact: true }),
    ).toBeVisible();

    const healerSeat = page.locator(
      `[data-event-slot-id="${fixture.slotIds.healerRequired}"]`,
    );

    await healerSeat
      .getByRole("button", { name: "Assign Character" })
      .click();

    const picker = page.getByRole("dialog", {
      name: "Assign Seat 3",
    });

    await picker
      .getByLabel("Search eligible Characters")
      .fill("E2EHealer");
    await picker
      .getByRole("button", { name: /E2EHealer/ })
      .click();

    await expect(picker).not.toBeVisible();
    await expect(healerSeat.getByText("E2EHealer")).toBeVisible();

    await page
      .getByRole("button", { name: "Preview update" })
      .click();

    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("Next version v2", { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByText("E2EHealer", { exact: true }).first(),
    ).toBeVisible();

    await preview
      .getByRole("button", { name: "Publish update as v2" })
      .click();

    await expect(preview).not.toBeVisible();
    await expect(
      page.getByText("Published v2", { exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Unpublish", exact: true })
      .click();

    const unpublishDialog = page.getByRole("dialog", {
      name: "Unpublish Event?",
    });

    await expect(unpublishDialog).toBeVisible();
    await unpublishDialog
      .getByRole("button", { name: "Unpublish now" })
      .click();

    await expect(unpublishDialog).not.toBeVisible();
    await expect(
      page.getByText("Unpublished · last v2", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Event unpublished. Immutable publication history was preserved.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
