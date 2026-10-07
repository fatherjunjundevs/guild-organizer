import { expect, test } from "@playwright/test";
import { createAuthenticatedEventBuilderFixture } from "./helpers/local-supabase";

function slot(
  page: import("@playwright/test").Page,
  slotId: string,
) {
  return page.locator(`[data-event-slot-id="${slotId}"]`);
}

function assignedCharacter(
  page: import("@playwright/test").Page,
  slotId: string,
  characterId: string,
) {
  return slot(page, slotId).locator(
    `[data-assigned-character-id="${characterId}"]`,
  );
}

async function dragAssignedCharacter(
  page: import("@playwright/test").Page,
  sourceSlotId: string,
  targetSlotId: string,
  characterId: string,
) {
  const source = assignedCharacter(page, sourceSlotId, characterId);

  // dragTo checks visibility and stability, but does not wait for draggable.
  await expect(source).toHaveAttribute("draggable", "true");
  await source.dragTo(slot(page, targetSlotId));

  const target = assignedCharacter(page, targetSlotId, characterId);
  await expect(target).toBeVisible();

  // A move renders optimistically. The target is draggable again only after
  // the save settles. Wait before the next drag, reload, or fixture cleanup.
  await expect(target).toHaveAttribute("draggable", "true");
}

test("Event Builder critical assignment workflow keeps warnings live", async ({
  page,
  context,
}) => {
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
    await expect(
      page.getByText("Duplicate assignment", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText("Required role unfilled", { exact: true })
        .first(),
    ).toBeVisible();

    const healerSeat = slot(page, fixture.slotIds.healerRequired);
    await healerSeat
      .getByRole("button", { name: "Assign Character" })
      .click();

    const picker = page.getByRole("dialog", {
      name: "Assign Seat 3",
    });

    await expect(picker).toBeVisible();
    await picker
      .getByLabel("Search eligible Characters")
      .fill("E2EHealer");
    await picker
      .getByRole("button", { name: /E2EHealer/ })
      .click();

    await expect(picker).not.toBeVisible();
    await expect(healerSeat.getByText("E2EHealer")).toBeVisible();
    await expect(
      healerSeat.getByText("Required role unfilled", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("1 warning", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Full", { exact: true }).first(),
    ).toBeVisible();

    const duplicateSeat = slot(
      page,
      fixture.slotIds.alphaDuplicate,
    );

    await duplicateSeat
      .getByRole("button", { name: "Clear" })
      .click();

    await expect(
      page.getByText("No warnings", { exact: true }),
    ).toBeVisible();
    await expect(
      duplicateSeat.getByRole("button", { name: "Assign Character" }),
    ).toBeVisible();

    await dragAssignedCharacter(
      page,
      fixture.slotIds.alphaPrimary,
      fixture.slotIds.alphaDuplicate,
      fixture.characterIds.alpha,
    );

    await expect(
      assignedCharacter(
        page,
        fixture.slotIds.alphaDuplicate,
        fixture.characterIds.alpha,
      ),
    ).toBeVisible();
    await expect(
      slot(page, fixture.slotIds.alphaPrimary).getByRole("button", {
        name: "Assign Character",
      }),
    ).toBeVisible();

    await dragAssignedCharacter(
      page,
      fixture.slotIds.alphaDuplicate,
      fixture.slotIds.betaAssigned,
      fixture.characterIds.alpha,
    );

    await expect(
      assignedCharacter(
        page,
        fixture.slotIds.betaAssigned,
        fixture.characterIds.alpha,
      ),
    ).toBeVisible();
    await expect(
      assignedCharacter(
        page,
        fixture.slotIds.alphaDuplicate,
        fixture.characterIds.beta,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("No warnings", { exact: true }),
    ).toBeVisible();

    // Confirm the completed swap is persisted, not just shown optimistically.
    await page.reload();
    await expect(
      assignedCharacter(
        page,
        fixture.slotIds.betaAssigned,
        fixture.characterIds.alpha,
      ),
    ).toBeVisible();
    await expect(
      assignedCharacter(
        page,
        fixture.slotIds.alphaDuplicate,
        fixture.characterIds.beta,
      ),
    ).toBeVisible();
    await expect(healerSeat.getByText("E2EHealer")).toBeVisible();
    await expect(
      slot(page, fixture.slotIds.alphaPrimary).getByRole("button", {
        name: "Assign Character",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("No warnings", { exact: true }),
    ).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
