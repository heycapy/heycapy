import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";

test.use({ storageState: authState("title-dates") });

// Wednesday Oct 7 2026, 8am
const WEDNESDAY = new Date(2026, 9, 7, 8, 0);

async function openAdd(page: Page) {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Dates"));
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  return modal(page, /^(new|edit) item$/);
}

test("a date typed into the title is highlighted, fills 'when' and leaves the title", async ({
  page,
}) => {
  const dialog = await openAdd(page);
  const title = uniqueName("pay rent");
  await dialog.locator("textarea").first().fill(`${title} friday 5pm`);

  await expect(dialog.getByTestId("title-date-highlight").locator("span")).toHaveText("friday 5pm");
  await expect(dialog.getByText("due Fri Oct 9 · 5pm")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Oct 9", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "time: 5 pm" })).toBeVisible();

  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toContainText("Oct 9 5pm");
  await expect(itemRow(page, title)).not.toContainText("friday");
});

test("[×] keeps the words as text and clears the date", async ({ page }) => {
  const dialog = await openAdd(page);
  const title = `${uniqueName("call mom")} tomorrow`;
  await dialog.locator("textarea").first().fill(title);
  await expect(dialog.getByRole("button", { name: "Oct 8", exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "not a date" }).click();
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "pick date" })).toBeVisible();

  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toBeVisible();
});

test("deleting the words gives the date back, and a picked date wins over typing", async ({
  page,
}) => {
  const dialog = await openAdd(page);
  const input = dialog.locator("textarea").first();
  await input.fill("gym friday");
  await expect(dialog.getByRole("button", { name: "Oct 9", exact: true })).toBeVisible();
  await input.fill("gym");
  await expect(dialog.getByRole("button", { name: "pick date" })).toBeVisible();

  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "20", exact: true }).click();
  await input.fill("gym friday 6pm");
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Oct 20", exact: true })).toBeVisible();
});

test("editing an item never reads dates from its title", async ({ page }) => {
  const dialog = await openAdd(page);
  const title = uniqueName("renew passport");
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();

  await itemRow(page, title).click();
  await dialog.locator("textarea").first().fill(`${title} tomorrow`);
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "pick date" })).toBeVisible();
});
