import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { field, modal, openSettings, option, saveSettings } from "../helpers/settings";

test.use({
  storageState: authState("item-menu"),
  permissions: ["clipboard-read", "clipboard-write"],
});
test.describe.configure({ mode: "default" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysFromToday(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
}

function shortDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function menuFor(page: Page, title: string) {
  return page.getByRole("dialog", { name: title });
}

function rowFor(page: Page, title: string) {
  return itemRow(page, title).locator("xpath=..");
}

async function openMenu(page: Page, title: string) {
  await rowFor(page, title).getByRole("button", { name: "item menu" }).click();
  await expect(menuFor(page, title)).toBeVisible();
  return menuFor(page, title);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Item menu"));
});

test("quick dates move an item, and a picked date too; back returns from the calendar", async ({
  page,
}) => {
  const title = uniqueName("call mom");
  await addItem(page, title);

  let menu = await openMenu(page, title);
  await expect(menu.getByRole("button", { name: /^due today / })).toBeVisible();
  await expect(menu.getByRole("button", { name: /^due next week / })).toBeVisible();
  await menu.getByRole("button", { name: /^due tomorrow / }).click();
  await expect(menu).not.toBeVisible();
  await expect(itemRow(page, title)).toContainText(`${shortDate(daysFromToday(1))} 9am`);

  await itemRow(page, title).click({ button: "right" });
  menu = menuFor(page, title);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: /^due tomorrow / })).toHaveCount(0);

  await menu.getByRole("button", { name: "pick a date…" }).click();
  await menu.getByRole("button", { name: "[ back ]", exact: true }).click();
  await expect(menu.getByRole("button", { name: /^due today / })).toBeVisible();

  await menu.getByRole("button", { name: "pick a date…" }).click();
  await menu.getByRole("button", { name: "next month" }).click();
  await menu.getByRole("button", { name: "5", exact: true }).click();
  await expect(menu).not.toBeVisible();
  const tomorrow = daysFromToday(1);
  const fifth = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 1, 5);
  await expect(itemRow(page, title)).toContainText(`${shortDate(fifth)} 9am`);
});

test("escape, a click outside and [x] close the menu", async ({ page }) => {
  const title = uniqueName("close me");
  await addItem(page, title);

  await openMenu(page, title);
  await page.keyboard.press("Escape");
  await expect(menuFor(page, title)).not.toBeVisible();

  await openMenu(page, title);
  await page.mouse.click(5, 5);
  await expect(menuFor(page, title)).not.toBeVisible();

  const menu = await openMenu(page, title);
  await menu.getByRole("button", { name: "close menu" }).click();
  await expect(menu).not.toBeVisible();
});

test("copy title, and delete with undo", async ({ page }) => {
  const title = uniqueName("renew passport");
  await addItem(page, title);

  let menu = await openMenu(page, title);
  await menu.getByRole("button", { name: "copy title" }).click();
  await expect(page.getByText("copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(title);

  menu = await openMenu(page, title);
  await menu.getByRole("button", { name: "delete" }).click();
  await expect(itemRow(page, title)).toHaveCount(0);
  await page.getByRole("button", { name: /undo/ }).click();
  await expect(itemRow(page, title)).toBeVisible();
});

test("a repeating item moves only this time: the next one stays on schedule", async ({ page }) => {
  const title = uniqueName("gym");
  await addItem(page, title);
  await (await openMenu(page, title)).getByRole("button", { name: /^due next week / }).click();

  await itemRow(page, title).click();
  const dialog = modal(page, /^edit item$/);
  await dialog.getByRole("button", { name: "on", exact: true }).click();
  await dialog.getByRole("button", { name: "week", exact: true }).click();
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const menu = await openMenu(page, title);
  await expect(menu.getByText("↺ weekly · moves only this time")).toBeVisible();
  await menu.getByRole("button", { name: /^due tomorrow / }).click();
  await expect(itemRow(page, title)).toContainText(`${shortDate(daysFromToday(1))} 9am`);

  await rowFor(page, title)
    .getByRole("button", { name: /^status: / })
    .click();
  await page
    .getByRole("menu", { name: "status" })
    .getByRole("button", { name: "completed" })
    .click();
  await expect(
    page.getByRole("button", {
      name: new RegExp(`${title}.*${shortDate(daysFromToday(14))} 9am`),
    })
  ).toBeVisible();
});

test("works in today, and moving out of today takes the item off the list", async ({ page }) => {
  const title = uniqueName("pay bill");
  await addItem(page, title);
  await (await openMenu(page, title)).getByRole("button", { name: /^due today / }).click();

  await page.getByRole("button", { name: "today", exact: true }).click();
  const today = page.getByRole("region", { name: "today" });
  await expect(today.getByRole("button", { name: title })).toBeVisible();
  await today.getByRole("button", { name: title }).click({ button: "right" });
  await menuFor(page, title)
    .getByRole("button", { name: /^due tomorrow / })
    .click();
  await expect(today.getByRole("button", { name: title })).toHaveCount(0);
});

test("read-only buckets only offer copy title", async ({ page }) => {
  const title = uniqueName("read me");
  await addItem(page, title);
  const settings = await openSettings(page);
  await option(field(settings, "read only"), "on").click();
  await saveSettings(settings);

  const menu = await openMenu(page, title);
  await expect(menu.getByRole("button")).toHaveText(["[x]", "copy title"]);
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("long-press opens a menu that fits the screen, without opening the item", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch is driven through Chrome DevTools");
    const title = uniqueName("water plants");
    await addItem(page, title);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(rowFor(page, title).getByRole("button", { name: "item menu" })).toBeVisible();

    const box = await itemRow(page, title).boundingBox();
    if (!box) throw new Error("row has no box");
    const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(700);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    const menu = menuFor(page, title);
    await expect(menu).toBeVisible();
    await expect(modal(page, /^edit item$/)).toHaveCount(0);
    const menuBox = await menu.boundingBox();
    expect(menuBox?.x).toBeGreaterThanOrEqual(8);
    expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(390 - 8);

    await menu.getByRole("button", { name: /^due tomorrow / }).tap();
    await expect(menu).not.toBeVisible();
    await expect(itemRow(page, title)).toContainText(`${shortDate(daysFromToday(1))} 9am`);
  });
});
