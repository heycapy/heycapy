import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";

test.use({ storageState: authState("recurring") });
test.describe.configure({ mode: "default" });

function itemDialog(page: Page) {
  return modal(page, /^(new|edit) item$/);
}

function shortDate(date: Date): string {
  return `${date.toLocaleString("en-US", { month: "short" })} ${date.getDate()}`;
}

async function addMonthlyItemDueToday(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = itemDialog(page);
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();
  await dialog.getByRole("button", { name: "on", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "on", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Recurring Test"));
});

test("skip moves a repeating item to its next date without adding a copy", async ({ page }) => {
  const title = uniqueName("pay rent");
  await addMonthlyItemDueToday(page, title);

  await itemRow(page, title).click();
  const dialog = itemDialog(page);
  await dialog.getByRole("button", { name: "[ skip ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await expect(itemRow(page, title)).toHaveCount(1);
  await itemRow(page, title).click();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  await expect(dialog.getByRole("button", { name: shortDate(nextMonth) })).toBeVisible();
});

test("skip is not offered for items that do not repeat", async ({ page }) => {
  const title = uniqueName("one-off");
  await addItem(page, title);

  await itemRow(page, title).click();
  await expect(itemDialog(page).getByText("edit item", { exact: true })).toBeVisible();
  await expect(itemDialog(page).getByRole("button", { name: "[ skip ]" })).toHaveCount(0);
});

test("repeats on picked weekdays, then on the last day of the month", async ({ page }) => {
  const title = uniqueName("gym");
  await addMonthlyItemDueToday(page, title);

  await itemRow(page, title).click();
  const dialog = itemDialog(page);
  await dialog.getByRole("button", { name: "week", exact: true }).click();
  await expect(dialog.getByText("↺ every week · on the deadline's day")).toBeVisible();
  for (const day of ["mon", "wed", "fri"]) {
    await dialog.getByRole("button", { name: day, exact: true }).click();
  }
  await expect(dialog.getByText("↺ every week on mon, wed, fri")).toBeVisible();
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toContainText("↺ mon, wed, fri");

  await itemRow(page, title).click();
  await expect(dialog.getByRole("button", { name: "wed", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await dialog.getByRole("button", { name: "weekdays", exact: true }).click();
  await expect(dialog.getByText("↺ every weekday")).toBeVisible();
  await dialog.getByRole("button", { name: "month", exact: true }).click();
  await dialog.getByRole("button", { name: "last day", exact: true }).click();
  await expect(dialog.getByText("↺ every month on the last day")).toBeVisible();
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("↺ monthly · last day");
});
