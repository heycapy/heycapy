import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { LOOK } from "@/constants";
import type { Look } from "@/components/looks/constants";
import { authState, specUserEmail } from "./auth";
import { E2E_DATABASE_FILE } from "./env";
import { openSettings } from "./settings";
import {
  addItem,
  bucketTab,
  createBucket,
  itemMenu,
  itemTick,
  newItemForm,
  selectBucket,
  untilStill,
} from "./buckets";
import { enableWebhook, postItem } from "./webhook";

// Deadlines stay ahead of the real clock, so no reminder fires and puts "notified" on a row
const NOW = new Date("2031-03-07T10:00:00Z");
const HIDE_PLACEHOLDERS = path.join(__dirname, "visual.css");
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

// A locator click scrolls the target into view first, and that sometimes scrolls the list to its end
async function clickInPlace(page: Page, target: Locator, button: "left" | "right" = "left") {
  await untilStill(page, target);
  const box = await target.boundingBox();
  if (!box) throw new Error("nothing to click");
  await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), {
    button,
  });
}

function setLook(spec: string, look: Look) {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set look = ? where user_id = (select id from users where email = ?)"
  ).run(look, specUserEmail(spec));
  db.close();
}

export function screenshotTests(spec: string, look: Look) {
  test.use({ storageState: authState(spec), timezoneId: "UTC", locale: "en-GB" });
  test.describe.configure({ mode: "default" });

  test.skip(!!process.env.CI, "screenshots are made and checked locally");

  // The seed finds buttons by their original names, "[ add ]" and the like
  test.beforeAll(async ({ browser }) => {
    setLook(spec, LOOK.original);
    const page = await browser.newPage({ storageState: authState(spec) });
    await seed(page);
    await page.close();
    setLook(spec, look);
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
    await clickInPlace(page, page.getByRole("button", { name: "renew passport" }));
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
    await clickInPlace(page, page.getByRole("button", { name: "renew passport" }), "right");
    await expect(itemMenu(page, "renew passport")).toBeVisible();
    await snap(page, "item-menu");
  });

  if (look === LOOK.original) {
    test.describe("signed out", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("login", async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("theme", t), THEMES[0]);
        await page.goto("/login");
        await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
        await snap(page, "login");
      });
    });
  }
}
