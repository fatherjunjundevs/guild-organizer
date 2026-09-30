import { expect, test } from "@playwright/test";

test("renders the Guild Organizer landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Guild Organizer" }),
  ).toBeVisible();

  await expect(page.getByText("Ragnarok: The New World")).toBeVisible();
  await expect(page.getByText("Command Center")).toBeVisible();
  await expect(page.getByText("Published")).toBeVisible();
  await expect(page.getByText("Characters")).toBeVisible();
});
