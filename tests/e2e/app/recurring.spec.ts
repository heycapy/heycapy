import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";

test.use({ storageState: authState("recurring") });
test.describe.configure({ mode: "default" });

function itemDialog(page: Page) {
  return modal(page, /^(new|edit) item$/);
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

test("repeating on the last day moves the date to the month's last day", async ({ page }) => {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastLabel = `${last.toLocaleString("en-US", { month: "short" })} ${last.getDate()}`;

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = itemDialog(page);
  const title = uniqueName("pay rent");
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "21", exact: true }).click();
  await dialog.getByRole("button", { name: "on", exact: true }).click();
  await dialog.getByRole("button", { name: "month", exact: true }).click();
  await dialog.getByRole("button", { name: "last day", exact: true }).click();
  await expect(dialog.getByRole("button", { name: lastLabel, exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText(`next ${lastLabel}`);
});
