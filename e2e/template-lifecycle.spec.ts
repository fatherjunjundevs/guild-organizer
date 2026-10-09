import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, fixtureTest as test } from "./helpers/test";
import { createAuthenticatedOwnerFixture } from "./helpers/local-supabase";

function editorDialog(page: Page) {
  return page.locator('dialog[open][aria-labelledby="team-board-editor-title"]');
}

function partyCard(page: Page, name: string) {
  return page.locator("[data-party-drag-card]", { hasText: name }).first();
}

function teamCard(page: Page, name: string) {
  return page.locator("[data-team-drag-card]", { hasText: name }).first();
}

async function createFlatTemplate(page: Page, guildId: string, marker: string) {
  const eventTypeName = `League ${marker}`;
  const templateName = `Template ${marker}`;

  await page.goto(`/app/guild/${guildId}/templates`);
  await expect(page.getByRole("heading", { level: 1, name: "Event Templates" })).toBeVisible();

  await page.getByRole("button", { name: "Manage Event Types" }).click();
  const eventTypeDialog = page.getByRole("dialog", { name: "Event Types" });
  await expect(eventTypeDialog).toBeVisible();

  await eventTypeDialog.locator('input[name="name"]').fill(eventTypeName);
  await eventTypeDialog.locator('input[name="description"]').fill("Phase 4.4B critical template E2E");
  await eventTypeDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(eventTypeDialog.getByText(eventTypeName, { exact: true })).toBeVisible();

  await eventTypeDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(eventTypeDialog).not.toBeVisible();

  const newTemplateButton = page.getByRole("button", { name: "New Template" });
  await expect(newTemplateButton).toBeEnabled();
  await newTemplateButton.click();

  const templateDialog = page.getByRole("dialog", { name: "Create Event Template" });
  await expect(templateDialog).toBeVisible();
  await templateDialog.locator('input[name="name"]').fill(templateName);
  await templateDialog.locator('textarea[name="description"]').fill("Critical browser lifecycle coverage");
  await templateDialog.locator('select[name="usesAreas"]').selectOption("false");
  await templateDialog.getByRole("button", { name: "Create Draft" }).click();

  await expect(templateDialog).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: templateName })).toBeVisible();

  await page.getByRole("link", { name: "Design teams" }).click();
  await expect(page.getByRole("heading", { level: 1, name: templateName })).toBeVisible();

  return { eventTypeName, templateName, templateUrl: page.url() };
}

async function createTeam(
  page: Page,
  options: { name: string; parties: number; seats: number },
) {
  await page.getByRole("button", { name: /^(Create first Team|Add Team)$/ }).first().click();

  const dialog = editorDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Create Team");

  await dialog.getByLabel("Team name").fill(options.name);
  await dialog.getByLabel("Seats per Party").selectOption(String(options.seats));
  await dialog.getByLabel("Starting Parties").selectOption(String(options.parties));
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: options.name })).toBeVisible();
}

async function editPartySeatCount(page: Page, partyName: string, seatCount: number) {
  await partyCard(page, partyName).getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = editorDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Seat count").selectOption(String(seatCount));
  return dialog;
}

test("owner completes the critical Template lifecycle with custom seats, activation, and cloning", async ({ page, context }) => {
  const fixture = await createAuthenticatedOwnerFixture(context);
  const marker = randomUUID().slice(0, 8);

  try {
    const created = await createFlatTemplate(page, fixture.guildId, marker);

    await createTeam(page, { name: "SUN", parties: 8, seats: 3 });
    await expect(page.locator("[data-party-drag-card]")).toHaveCount(8);

    let firstParty = partyCard(page, "Party 1");
    await expect(firstParty.getByText("3 seats", { exact: true })).toBeVisible();

    let dialog = await editPartySeatCount(page, "Party 1", 8);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    firstParty = partyCard(page, "Party 1");
    await expect(firstParty.getByText("8 seats", { exact: true })).toBeVisible();

    await firstParty.getByRole("button").filter({ hasText: "Open seat" }).last().click();
    dialog = editorDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Role requirement").fill("Healer");
    await dialog.getByRole("button", { name: "Save Role" }).click();
    await expect(dialog).not.toBeVisible();

    firstParty = partyCard(page, "Party 1");
    await expect(firstParty.getByText("Healer", { exact: true })).toBeVisible();

    dialog = await editPartySeatCount(page, "Party 1", 5);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Confirm the removal with the button below.", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm remove 3 seats" }),
    ).toBeVisible();

    firstParty = partyCard(page, "Party 1");
    await expect(firstParty.getByText("8 seats", { exact: true })).toBeVisible();
    await expect(firstParty.getByText("Healer", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Confirm remove 3 seats" }).click();
    await expect(dialog).not.toBeVisible();

    firstParty = partyCard(page, "Party 1");
    await expect(firstParty.getByText("5 seats", { exact: true })).toBeVisible();
    await expect(firstParty.getByText("Healer", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const previewDialog = page.locator('dialog[open][aria-labelledby="template-preview-title"]');
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.getByText("Validation passed", { exact: true })).toBeVisible();
    await expect(previewDialog.getByRole("heading", { level: 3, name: "SUN" })).toBeVisible();
    await expect(previewDialog.getByText("Party 1", { exact: true })).toBeVisible();
    await expect(previewDialog.getByText("5 seats", { exact: true })).toBeVisible();

    await previewDialog.getByRole("button", { name: "Close Preview" }).click();
    await expect(previewDialog).not.toBeVisible();

    const activateButton = page.getByRole("button", { name: "Activate Template" });
    await expect(activateButton).toBeEnabled();
    await activateButton.click();

    await expect(page.getByText("Template activated successfully.", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Structural edits return this active Template to Draft.", { exact: true }),
    ).toBeVisible();

    const sunTeam = teamCard(page, "SUN");
    await sunTeam.getByRole("button", { name: "Rename Team" }).click();

    dialog = editorDialog(page);
    await dialog.getByLabel("Team name").fill("SUN Prime");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await expect(page.getByRole("heading", { level: 3, name: "SUN Prime" })).toBeVisible();
    await expect(
      page.getByText("Structural edits return this active Template to Draft.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Activate Template" })).toBeDisabled();

    const sourceUrl = page.url();
    expect(sourceUrl).toBe(created.templateUrl);

    await page.getByRole("link", { name: "Back to Event Templates" }).click();
    await expect(page.getByRole("heading", { level: 2, name: created.templateName })).toBeVisible();

    await page.getByRole("button", { name: "Clone", exact: true }).first().click();
    const cloneDialog = page.getByRole("dialog", { name: "Create independent Draft copy" });
    await expect(cloneDialog).toBeVisible();

    const cloneName = `${created.templateName} Copy E2E`;
    await cloneDialog.locator('input[name="name"]').fill(cloneName);
    await cloneDialog.getByRole("button", { name: "Clone as Draft" }).click();

    await expect(page.getByRole("heading", { level: 1, name: cloneName })).toBeVisible();
    expect(page.url()).not.toBe(sourceUrl);
    await expect(page.getByRole("heading", { level: 3, name: "SUN Prime" })).toBeVisible();

    const cloneTeam = teamCard(page, "SUN Prime");
    await cloneTeam.getByRole("button", { name: "Rename Team" }).click();

    dialog = editorDialog(page);
    await dialog.getByLabel("Team name").fill("CLONE SUN");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "CLONE SUN" })).toBeVisible();

    await page.goto(sourceUrl);
    await expect(page.getByRole("heading", { level: 1, name: created.templateName })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "SUN Prime" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "CLONE SUN" })).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test("Party and Team deletion preserve Template Designer scroll position", async ({ page, context }) => {
  const fixture = await createAuthenticatedOwnerFixture(context);
  const marker = randomUUID().slice(0, 8);

  try {
    await page.setViewportSize({
      // Keep the real Party board narrower than eight Party cards so the
      // browser has an actual horizontal scroll range to preserve.
      width: 760,
      height: 650,
    });
    await createFlatTemplate(page, fixture.guildId, `scroll-${marker}`);

    await createTeam(page, { name: "SUN", parties: 8, seats: 3 });
    await createTeam(page, { name: "MOON", parties: 1, seats: 1 });

    const board = page.getByLabel("SUN Party board");
    await expect(board).toBeVisible();

    await expect
      .poll(
        () =>
          board.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        {
          message:
            "SUN Party board should have a real horizontal scroll range",
        },
      )
      .toBeGreaterThan(0);

    const seededLeft = await board.evaluate((element) => {
      element.scrollLeft = Math.min(
        280,
        element.scrollWidth - element.clientWidth,
      );
      return element.scrollLeft;
    });
    expect(seededLeft).toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, 160));

    const partyFour = board.locator("[data-party-drag-card]", { hasText: "Party 4" }).first();
    await partyFour.getByRole("button", { name: "Delete", exact: true }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    let alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();

    const partyDeleteWindowY = await page.evaluate(() => window.scrollY);
    const partyDeleteBoardLeft = await board.evaluate((element) => element.scrollLeft);

    await alertDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(alertDialog).toHaveCount(0);
    await expect(board.locator("[data-party-drag-card]")).toHaveCount(7);

    const afterPartyWindowY = await page.evaluate(() => window.scrollY);
    const afterPartyBoardLeft = await board.evaluate((element) => element.scrollLeft);

    expect(Math.abs(afterPartyWindowY - partyDeleteWindowY)).toBeLessThanOrEqual(2);
    expect(Math.abs(afterPartyBoardLeft - partyDeleteBoardLeft)).toBeLessThanOrEqual(2);

    await page.evaluate(() => window.scrollTo(0, 160));

    const moonTeam = teamCard(page, "MOON");
    await moonTeam.getByRole("button", { name: "Delete Team" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();

    const teamDeleteWindowY = await page.evaluate(() => window.scrollY);

    await alertDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(alertDialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "MOON" })).toHaveCount(0);

    const afterTeamWindowY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterTeamWindowY - teamDeleteWindowY)).toBeLessThanOrEqual(2);
  } finally {
    await fixture.cleanup();
  }
});
