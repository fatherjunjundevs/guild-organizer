import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedEventBuilderFixture } from "./helpers/local-supabase";

test("Publication history preserves immutable versions across updates and unpublish", async ({
  page,
  context,
}) => {
  const fixture = await createAuthenticatedEventBuilderFixture(context);

  try {
    const inactive = await fixture.userClient.rpc("set_character_manual_status", {
      p_character_id: fixture.characterIds.beta, p_status: "inactive",
    });
    expect(inactive.error).toBeNull();
    await page.goto(
      `/app/guild/${fixture.guildId}/events/${fixture.eventId}`,
    );

    await page
      .getByRole("button", { name: "Preview & publish" })
      .click();

    const preview = page.getByRole("dialog", {
      name: "Member lineup preview",
    });

    await preview
      .getByRole("button", { name: "Publish v1" })
      .click();
    await expect(page.getByRole("button", { name: "History (1)" })).toBeVisible();
    const active = await fixture.userClient.rpc("set_character_manual_status", {
      p_character_id: fixture.characterIds.beta, p_status: "active",
    });
    expect(active.error).toBeNull();
    await page.reload();

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

    await page
      .getByRole("button", { name: "Preview update" })
      .click();
    await preview
      .getByRole("button", { name: "Publish update as v2" })
      .click();

    await page
      .getByRole("button", { name: "History (2)" })
      .click();

    const history = page.getByRole("dialog", {
      name: "Publication history",
    });

    await expect(history).toBeVisible();

    const version2 = history.locator(
      '[data-publication-version-number="2"]',
    );
    const version1 = history.locator(
      '[data-publication-version-number="1"]',
    );

    await expect(
      version2.getByText("Current member version", { exact: true }),
    ).toBeVisible();
    await expect(
      version1.getByText("Historical", { exact: true }),
    ).toBeVisible();

    await version1
      .getByRole("button", { name: "View v1 snapshot" })
      .click();

    const snapshot1 = history.locator(
      '[data-publication-snapshot-version="1"]',
    );

    await expect(snapshot1).toBeVisible();
    await expect(snapshot1.getByText("Inactive", { exact: true })).toHaveCount(1);
    await expect(history.getByRole("status")).toHaveText("Loaded immutable version 1 snapshot.");
    await expect(
      snapshot1.getByText("E2EAlphaTank", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      snapshot1.getByText("E2EHealer", { exact: true }),
    ).toHaveCount(0);

    await version2
      .getByRole("button", { name: "View v2 snapshot" })
      .click();

    const snapshot2 = history.locator(
      '[data-publication-snapshot-version="2"]',
    );

    await expect(snapshot2).toBeVisible();
    await expect(snapshot2.getByText("Inactive", { exact: true })).toHaveCount(0);
    await expect(
      snapshot2.getByText("E2EHealer", { exact: true }).first(),
    ).toBeVisible();

    await history
      .getByRole("button", { name: "Close history" })
      .click();

    await page
      .getByRole("button", { name: "Unpublish", exact: true })
      .click();

    const unpublishDialog = page.getByRole("dialog", {
      name: "Unpublish Event?",
    });

    await unpublishDialog
      .getByRole("button", { name: "Unpublish now" })
      .click();

    await page
      .getByRole("button", { name: "History (2)" })
      .click();

    await expect(history).toBeVisible();
    await expect(
      history.getByText("Current member version", { exact: true }),
    ).toHaveCount(0);
    await expect(
      history.getByText("Historical", { exact: true }),
    ).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(history).not.toBeVisible();
    await expect(page.getByRole("button", { name: "History (2)" })).toBeFocused();
    await page.getByRole("button", { name: "Preview & republish" }).click();
    await preview.getByRole("button", { name: "Republish as v3" }).click();
    await expect(page.getByRole("button", { name: "History (3)" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "History (3)" }).click();
    await expect(history.locator('[data-publication-version-number="3"]').getByText("Current member version", { exact: true })).toBeVisible();
    await history.getByRole("button", { name: "View v1 snapshot" }).click();
    await expect(snapshot1.getByText("Inactive", { exact: true })).toBeVisible();
    await expect(snapshot1.getByText("E2EHealer", { exact: true })).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("History pages are bounded and publication children reject foreign Guild and anonymous reads", async ({ page, context, browser }) => {
  const fixture = await createAuthenticatedEventBuilderFixture(context);
  const foreignContext = await browser.newContext();
  const foreign = await createAuthenticatedEventBuilderFixture(foreignContext);
  try {
    expect((await fixture.userClient.rpc("publish_event", { p_event_id: fixture.eventId })).error).toBeNull();
    for (let version = 2; version <= 12; version++) {
      expect((await fixture.userClient.rpc("update_event_publication", { p_event_id: fixture.eventId })).error).toBeNull();
    }
    for (const table of ["event_publication_versions", "event_publication_slots", "event_publication_assignments"]) {
      const denied = await foreign.userClient.from(table).select("id").eq("guild_id", fixture.guildId).eq("event_id", fixture.eventId);
      expect(denied.error).toBeNull(); expect(denied.data).toEqual([]);
      const anonymous = await fixture.anonymousClient.from(table).select("id").eq("guild_id", fixture.guildId).eq("event_id", fixture.eventId);
      expect(anonymous.error?.code).toBe("42501");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/app/guild/${fixture.guildId}/events/${fixture.eventId}`);
    await page.getByRole("button", { name: "History (12)" }).click();
    const history = page.getByRole("dialog", { name: "Publication history" });
    await expect(history.locator("[data-publication-version-number]")).toHaveCount(10);
    await expect(history.locator('[data-publication-version-number="12"]').getByText("3/6 assigned")).toBeVisible();
    await history.getByRole("button", { name: "Older versions" }).click();
    await expect(history.locator("[data-publication-version-number]")).toHaveCount(2);
    await expect(history.getByRole("button", { name: "Older versions" })).toBeDisabled();
    await history.getByRole("button", { name: "View v1 snapshot" }).click();
    await expect(history.locator('[data-publication-snapshot-version="1"]').getByText("E2EAlphaTank", { exact: true }).first()).toBeVisible();
    await history.getByRole("button", { name: "Newer versions" }).click();
    await expect(history.locator("[data-publication-version-number]")).toHaveCount(10);
    await expect(history.getByRole("button", { name: "Newer versions" })).toBeDisabled();
    await history.getByRole("button", { name: "Close history" }).click();
    await expect(page.getByRole("button", { name: "History (12)" })).toBeFocused();
    await expect(page.locator("[data-publication-version-number]")).toHaveCount(0);
  } finally {
    await fixture.cleanup(); await foreign.cleanup(); await foreignContext.close();
  }
});
