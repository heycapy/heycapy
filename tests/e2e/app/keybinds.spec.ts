import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  activeBucketTitle,
  addBox,
  createAndSelectBucket,
  newItemForm,
  selectBucket,
  uniqueName,
} from "../helpers/buckets";
import { settingsDialog } from "../helpers/settings";

test.use({ storageState: authState("keybinds") });
test.describe.configure({ mode: "default" });

const PREFIX = "Control+;";

async function prefixThen(page: Page, key: string) {
  await page.keyboard.press(PREFIX);
  await page.keyboard.press(key);
}

function todayTab(page: Page) {
  return page.getByRole("button", { name: "today", exact: true });
}

async function twoBuckets(page: Page) {
  await page.goto("/");
  const first = uniqueName("Key one");
  const second = uniqueName("Key two");
  await createAndSelectBucket(page, first);
  await createAndSelectBucket(page, second);
  await selectBucket(page, first);
  return { first, second };
}

test("the prefix then h / l / t / a number moves between today and the buckets", async ({
  page,
}) => {
  const { first, second } = await twoBuckets(page);

  await prefixThen(page, "l");
  await expect(activeBucketTitle(page)).toHaveText(second);
  await prefixThen(page, "h");
  await expect(activeBucketTitle(page)).toHaveText(first);
  await prefixThen(page, "t");
  await expect(todayTab(page)).toHaveAttribute("aria-current", "page");
  await prefixThen(page, "h");
  await expect(activeBucketTitle(page)).toHaveText(second);

  await prefixThen(page, "1");
  const firstTab = await activeBucketTitle(page).innerText();
  await prefixThen(page, "2");
  const secondTab = await activeBucketTitle(page).innerText();
  expect(secondTab).not.toBe(firstTab);
  await prefixThen(page, "1");
  await prefixThen(page, "l");
  await expect(activeBucketTitle(page)).toHaveText(secondTab);
});

test("the prefix opens search, tweaks and the bucket's settings", async ({ page }) => {
  const { first } = await twoBuckets(page);

  await prefixThen(page, "/");
  await expect(page.getByRole("dialog", { name: "search" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "search" })).toBeHidden();

  await prefixThen(page, ",");
  await expect(page.getByRole("dialog", { name: /tweaks/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /tweaks/ })).toBeHidden();

  await prefixThen(page, "s");
  await expect(settingsDialog(page)).toContainText(`bucket settings ${first}`);
  await page.keyboard.press("Escape");
  await expect(settingsDialog(page)).toBeHidden();
});

test("the prefix adds: a focuses the add box, d opens the form", async ({ page }) => {
  await twoBuckets(page);

  await prefixThen(page, "a");
  await expect(addBox(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await prefixThen(page, "d");
  await expect(newItemForm(page)).toBeVisible();
});

test("a key typed in a field is text, but the prefix still works from it", async ({ page }) => {
  await twoBuckets(page);

  await addBox(page).focus();
  await page.keyboard.type("tah");
  await expect(addBox(page)).toHaveValue("tah");
  await expect(todayTab(page)).not.toHaveAttribute("aria-current");

  await prefixThen(page, "t");
  await expect(todayTab(page)).toHaveAttribute("aria-current", "page");
});

test("a key without the prefix does nothing, and the prefix gives up after a moment", async ({
  page,
}) => {
  const { first } = await twoBuckets(page);

  await page.locator("body").press("t");
  await expect(activeBucketTitle(page)).toHaveText(first);

  await page.keyboard.press(PREFIX);
  await page.waitForTimeout(1800);
  await page.keyboard.press("t");
  await expect(activeBucketTitle(page)).toHaveText(first);

  await prefixThen(page, "z");
  await page.keyboard.press("t");
  await expect(activeBucketTitle(page)).toHaveText(first);
});

test("the prefix then c opens capy, and Escape closes it", async ({ page }) => {
  await twoBuckets(page);

  await prefixThen(page, "c");
  const input = page.getByPlaceholder("ask capy...");
  await expect(input).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
});
