import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItem,
  bucketTab,
  createAndSelectBucket,
  itemRow,
  uniqueName,
} from "../helpers/buckets";
import { field, option } from "../helpers/settings";

test.use({ storageState: authState("focus-mode") });
test.describe.configure({ mode: "serial" });

async function focusFromTweaks(page: Page) {
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "tweaks", exact: true }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await option(field(tweaks, "focus mode"), "on").click();
}

function exitFocus(page: Page) {
  return page.getByRole("button", { name: "exit focus mode", exact: true });
}

async function twoBuckets(page: Page) {
  await page.goto("/");
  const first = uniqueName("Focus one");
  const second = uniqueName("Focus two");
  await createAndSelectBucket(page, first);
  const firstItem = uniqueName("first item");
  await addItem(page, firstItem);
  await createAndSelectBucket(page, second);
  const secondItem = uniqueName("second item");
  await addItem(page, secondItem);
  return { first, second, firstItem, secondItem };
}

test("focus mode from tweaks keeps only the bucket name, the items and the add box", async ({
  page,
}) => {
  const { second, secondItem } = await twoBuckets(page);

  await focusFromTweaks(page);

  await expect(exitFocus(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "your menu", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "chat with capy" })).toBeHidden();
  await expect(bucketTab(page, "search")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "tweaks" })).toBeHidden();
  await expect(page.getByRole("button", { name: `${second}, change bucket` })).toBeVisible();
  await expect(itemRow(page, secondItem)).toBeVisible();
  await expect(addBox(page)).toBeVisible();
});

test("the bucket name switches bucket in focus mode, and focus mode survives a reload", async ({
  page,
}) => {
  const { first, second, firstItem, secondItem } = await twoBuckets(page);
  await focusFromTweaks(page);

  await page.getByRole("button", { name: `${second}, change bucket` }).click();
  await page
    .getByRole("group", { name: "change bucket" })
    .getByRole("button", { name: first })
    .click();
  await expect(itemRow(page, firstItem)).toBeVisible();
  await expect(itemRow(page, secondItem)).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: `${first}, change bucket` })).toBeVisible();
  await expect(exitFocus(page)).toBeVisible();

  await exitFocus(page).click();
  await expect(exitFocus(page)).toBeHidden();
  await expect(bucketTab(page, first)).toBeVisible();
  await expect(page.getByRole("button", { name: "your menu", exact: true })).toBeVisible();
});

test("today is in the focus mode dropdown, and prefix t goes there", async ({ page }) => {
  const { second } = await twoBuckets(page);
  await focusFromTweaks(page);

  await page.getByRole("button", { name: `${second}, change bucket` }).click();
  await page
    .getByRole("group", { name: "change bucket" })
    .getByRole("button", { name: "today" })
    .click();
  await expect(page.getByRole("button", { name: "today, change bucket" })).toBeVisible();
  await expect(exitFocus(page)).toBeVisible();

  await page.keyboard.press("Control+;");
  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "today, change bucket" })).toBeHidden();

  await page.keyboard.press("Control+;");
  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "today, change bucket" })).toBeVisible();
});

test("the prefix then f turns focus mode on and off", async ({ page }) => {
  const { second } = await twoBuckets(page);

  await page.keyboard.press("Control+;");
  await page.keyboard.press("f");
  await expect(exitFocus(page)).toBeVisible();
  await expect(page.getByRole("button", { name: `${second}, change bucket` })).toBeVisible();

  await page.keyboard.press("Control+;");
  await page.keyboard.press("f");
  await expect(exitFocus(page)).toBeHidden();
  await expect(bucketTab(page, second)).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test("the exit icon is there and leaves focus mode", async ({ page }) => {
    await twoBuckets(page);
    await focusFromTweaks(page);
    await expect(exitFocus(page)).toBeVisible();
    await exitFocus(page).tap();
    await expect(exitFocus(page)).toBeHidden();
  });
});
