import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItemButton,
  createAndSelectBucket,
  editForm,
  itemRow,
  newItemForm,
  uniqueName,
  openDetail,
  detailChip,
} from "../helpers/buckets";

test.use({ storageState: authState("title-dates") });

// Wednesday Oct 7 2026, 8am
const WEDNESDAY = new Date(2026, 9, 7, 8, 0);

async function openBucket(page: Page) {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Dates"));
}

async function openAdd(page: Page) {
  await openBucket(page);
  await addItemButton(page).click();
  return newItemForm(page);
}

test("the add box reads a typed date, adds on enter and stays ready for the next", async ({
  page,
}) => {
  await openBucket(page);
  const title = uniqueName("pay rent");
  await addBox(page).fill(`${title} friday 5pm`);
  await expect(page.getByTestId("quick-add-hint")).toHaveText("Fri Oct 9 · 5pm");

  await addBox(page).press("Enter");
  await expect(itemRow(page, title)).toContainText("Oct 9 5pm");
  await expect(itemRow(page, title)).not.toContainText("friday");
  await expect(addBox(page)).toHaveValue("");
  await expect(addBox(page)).toBeFocused();
  await expect(page.getByTestId("quick-add-hint")).toHaveCount(0);
  await expect(page.getByText("new item", { exact: true })).toHaveCount(0);
});

test("expand opens the full form with what was typed, and [×] there clears the date", async ({
  page,
}) => {
  await openBucket(page);
  const title = `${uniqueName("call mom")} tomorrow`;
  await addBox(page).fill(title);
  await addItemButton(page).click();

  const dialog = newItemForm(page);
  await expect(dialog.locator("textarea").first()).toHaveValue(title);
  await expect(dialog.getByTestId("title-date-highlight").locator("span")).toHaveText("tomorrow");
  await expect(detailChip(dialog, "date")).toHaveAccessibleName(/^date: Oct 8 · /);

  await dialog.getByRole("button", { name: "not a date" }).click();
  await expect(detailChip(dialog, "date")).toHaveAccessibleName("date");
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, title)).toBeVisible();
  await expect(addBox(page)).toHaveValue("");
});

test("a date typed into the title is highlighted, fills 'when' and leaves the title", async ({
  page,
}) => {
  const dialog = await openAdd(page);
  const title = uniqueName("pay rent");
  await dialog.locator("textarea").first().fill(`${title} friday 5pm`);

  await expect(dialog.getByTestId("title-date-highlight").locator("span")).toHaveText("friday 5pm");
  await expect(detailChip(dialog, "date")).toHaveAccessibleName("date: Oct 9 · 5 pm");

  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toContainText("Oct 9 5pm");
  await expect(itemRow(page, title)).not.toContainText("friday");
});

test("[×] keeps the words as text and clears the date", async ({ page }) => {
  const dialog = await openAdd(page);
  const title = `${uniqueName("call mom")} tomorrow`;
  await dialog.locator("textarea").first().fill(title);
  await expect(detailChip(dialog, "date")).toHaveAccessibleName(/^date: Oct 8 · /);

  await dialog.getByRole("button", { name: "not a date" }).click();
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(detailChip(dialog, "date")).toHaveAccessibleName("date");

  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, title)).toBeVisible();
});

test("deleting the words gives the date back, and a picked date wins over typing", async ({
  page,
}) => {
  const dialog = await openAdd(page);
  const input = dialog.locator("textarea").first();
  await input.fill("gym friday");
  await expect(detailChip(dialog, "date")).toHaveAccessibleName(/^date: Oct 9 · /);
  await input.fill("gym");
  await expect(detailChip(dialog, "date")).toHaveAccessibleName("date");

  await openDetail(dialog, "date");
  await page.getByRole("button", { name: "20", exact: true }).click();
  await input.fill("gym friday 6pm");
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(detailChip(dialog, "date")).toHaveAccessibleName(/^date: Oct 20 · /);
});

test("editing an item never reads dates from its title", async ({ page }) => {
  const dialog = await openAdd(page);
  const title = uniqueName("renew passport");
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "add", exact: true }).click();

  await itemRow(page, title).click();
  const edit = editForm(page);
  await edit.locator("textarea").first().fill(`${title} tomorrow`);
  await expect(edit.getByTestId("title-date-highlight")).toHaveCount(0);
  await expect(detailChip(edit, "date")).toHaveAccessibleName("date");
});
