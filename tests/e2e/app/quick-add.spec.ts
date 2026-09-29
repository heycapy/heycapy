import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("quick-add"), hasTouch: true });

const PHONE = { width: 390, height: 844 };

// Buckets are created through the desktop tabs; the rest runs at phone size
async function openBucketOnPhone(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await createAndSelectBucket(page, name);
  await page.setViewportSize(PHONE);
}

function addButton(page: Page) {
  return page.getByRole("button", { name: "[ add + ]", exact: true });
}

// The modal sheet hides the list from the accessibility tree, so rows are matched by text
function rowBehindSheet(page: Page, title: string) {
  return page.locator("main").getByText(title, { exact: true });
}

function quickAddSheet(page: Page) {
  return page
    .getByRole("dialog", { name: "new item" })
    .filter({ has: page.getByRole("button", { name: "[ more ]", exact: true }) });
}

test("the bottom bar's add opens a sheet that stays open for the next item", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Quick"));
  await expect(addButton(page)).toHaveCount(1);

  await addButton(page).tap();
  const sheet = quickAddSheet(page);
  const title = sheet.getByRole("textbox", { name: "title" });
  await expect(title).toBeFocused();

  const first = uniqueName("first");
  await title.fill(first);
  await title.press("Enter");
  await expect(rowBehindSheet(page, first)).toBeVisible();
  await expect(title).toHaveValue("");
  await expect(title).toBeFocused();

  const second = uniqueName("second");
  await title.fill(second);
  await sheet.getByRole("button", { name: "[ add ]", exact: true }).tap();
  await expect(rowBehindSheet(page, second)).toBeVisible();
  await expect(title).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
});

test("tapping the empty space under the list opens the sheet; more keeps the title", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Empty tap"));

  const box = await page.locator("main").boundingBox();
  if (!box) throw new Error("main has no box");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 200);
  const sheet = quickAddSheet(page);
  await expect(sheet).toBeVisible();

  const title = uniqueName("expanded");
  await sheet.getByRole("textbox", { name: "title" }).fill(title);
  await sheet.getByRole("button", { name: "[ more ]", exact: true }).tap();
  await expect(sheet).not.toBeVisible();
  const form = page.getByRole("dialog", { name: "new item" });
  await expect(form.locator("textarea")).toHaveValue(title);
  await form.getByRole("button", { name: "[ add ]", exact: true }).tap();
  await expect(itemRow(page, title)).toBeVisible();
});

test("today has no add; new buckets start from the bucket switcher", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Switcher"));

  await page.getByRole("button", { name: "today" }).tap();
  await expect(addButton(page)).toHaveCount(0);

  await page.getByRole("button", { name: "choose bucket" }).tap();
  await page.getByRole("button", { name: "new bucket" }).tap();
  await expect(page.getByRole("button", { name: /^Blank/ })).toBeVisible();
});
