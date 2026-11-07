import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  bucketTab,
  createBucket,
  itemMenu,
  itemTick,
  newItemForm,
  selectBucket,
} from "../helpers/buckets";
import { enableWebhook, postItem } from "../helpers/webhook";
import { openSettings } from "../helpers/settings";

test.use({ storageState: authState("visual"), timezoneId: "UTC", locale: "en-GB" });
test.describe.configure({ mode: "default" });

test.skip(!!process.env.CI, "screenshots are made and checked locally");

// Deadlines stay ahead of the real clock, so no reminder fires and puts "notified" on a row
const NOW = new Date("2031-03-07T10:00:00Z");
const HIDE_PLACEHOLDERS = path.join(__dirname, "..", "helpers", "visual.css");
const GROCERIES = "groceries";
const WORK = "work";
const PHONE = { width: 390, height: 844 };
const THEMES = ["gruvbox-dark-2", "capy", "terminal"];

async function seed(page: Page) {
  await page.goto("/");
  if (await bucketTab(page, WORK).isVisible()) return;
  await createBucket(page, GROCERIES);
  await selectBucket(page, GROCERIES);
  const webhook = await enableWebhook(page);
  for (const item of [
    { title: "oat milk and eggs", deadline: "2031-03-09T09:00:00Z" },
    { title: "pay the electricity bill", deadline: "2031-03-01T18:00:00Z" },
    { title: "renew passport", deadline: "2031-06-14T12:00:00Z", recurring: "yearly" },
  ]) {
    expect((await postItem(page.request, webhook, item)).status()).toBe(201);
  }
  await page.reload();
  await addItem(page, "bread");
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  await newItemForm(page).locator("textarea").fill("call mum\nabout the trip");
  await newItemForm(page).getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(page.getByRole("button", { name: /^call mum/ })).toBeVisible();
  await itemTick(page, "bread").click();
  await expect(itemTick(page, "bread")).toBeChecked();
  await createBucket(page, WORK);
}

async function openGroceries(page: Page, theme: string) {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.clock.setFixedTime(NOW);
  await page.goto("/");
  await selectBucket(page, GROCERIES);
}

async function snap(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: [page.locator(`svg[viewBox="0 0 16 16"]`)],
    stylePath: HIDE_PLACEHOLDERS,
  });
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: authState("visual") });
  await seed(page);
  await page.close();
});

for (const theme of THEMES) {
  test.describe(theme, () => {
    test("bucket list", async ({ page }) => {
      await openGroceries(page, theme);
      await snap(page, `${theme}-list`);
    });

    test("new item form", async ({ page }) => {
      await openGroceries(page, theme);
      await page.getByRole("button", { name: "add with details", exact: true }).click();
      await expect(newItemForm(page)).toBeVisible();
      await snap(page, `${theme}-new-item`);
    });

    test("bucket list on a phone", async ({ page }) => {
      await page.setViewportSize(PHONE);
      await openGroceries(page, theme);
      await snap(page, `${theme}-phone-list`);
    });
  });
}

test("edit item panel", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "renew passport" }).click();
  await expect(page.getByRole("dialog", { name: "edit item", exact: true })).toBeVisible();
  await snap(page, "edit-item");
});

test("avatar menu", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await snap(page, "avatar-menu");
});

test("bucket settings", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await openSettings(page);
  await snap(page, "bucket-settings");
});

test("tweaks", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "tweaks", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "tweaks" })).toBeVisible();
  await snap(page, "tweaks");
});

test("search", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "search", exact: true }).click();
  await page.getByRole("textbox", { name: "search all items" }).fill("pa");
  await snap(page, "search");
});

test("chat", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "chat with capy" }).click();
  await snap(page, "chat");
});

test("add drawer on a phone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  await expect(newItemForm(page)).toBeVisible();
  await snap(page, "phone-new-item");
});

test("item menu", async ({ page }) => {
  await openGroceries(page, THEMES[0]);
  await page.getByRole("button", { name: "renew passport" }).click({ button: "right" });
  await expect(itemMenu(page, "renew passport")).toBeVisible();
  await snap(page, "item-menu");
});
