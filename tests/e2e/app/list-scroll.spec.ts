import { test, expect, type Page } from "@playwright/test";
import { login, uniqueEmail } from "../helpers/login";
import { field, openSettings, option, saveSettings } from "../helpers/settings";
import {
  addItem,
  addBox,
  addItemButton,
  createAndSelectBucket,
  itemRow,
  newItemForm,
  uniqueName,
} from "../helpers/buckets";

const TITLES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

async function bucketWithItems(page: Page, count = TITLES.length) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, uniqueEmail("e2e-list-scroll"));
  await createAndSelectBucket(page, uniqueName("scroll"));
  for (const title of TITLES) await addItem(page, title);
  for (let i = TITLES.length + 1; i <= count; i++) await addItem(page, `row ${i}`);
}

function scrollRoom(page: Page) {
  return page.locator("main").evaluate((el) => el.scrollHeight - el.clientHeight);
}

test("a list that fits has no empty space to scroll into", async ({ page }) => {
  await bucketWithItems(page);
  expect(await scrollRoom(page)).toBeLessThanOrEqual(0);
});

test("with the add form open, scrolling over it leaves the list where it is", async ({ page }) => {
  test.setTimeout(90_000);
  await bucketWithItems(page, 22);
  await addItemButton(page).click();
  const title = newItemForm(page).locator("textarea").first();
  await expect(title).toBeFocused();
  const main = page.locator("main");
  await expect(main).toHaveCSS("overflow-y", "hidden");
  const before = await main.evaluate((el) => el.scrollTop);
  const box = await title.boundingBox();
  await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 5);
  await page.mouse.wheel(0, 1500);
  await page.mouse.move(640, 200);
  await page.mouse.wheel(0, 1500);
  await expect(title).toBeFocused();
  expect(await main.evaluate((el) => el.scrollTop)).toBe(before);
});

test("editing the bottom row brings it above the edit form", async ({ page }) => {
  await bucketWithItems(page);
  await itemRow(page, "eight").click();
  const panel = page.locator("[data-item-panel]");
  await expect(panel).toBeVisible();
  await expect
    .poll(async () => {
      const row = await itemRow(page, "eight").boundingBox();
      const top = (await panel.boundingBox())?.y ?? 0;
      return (row?.y ?? Infinity) + (row?.height ?? 0) <= top;
    })
    .toBe(true);
});

test("a long list sorted by deadline never makes the page itself taller", async ({ page }) => {
  test.setTimeout(90_000);
  await bucketWithItems(page, 18);
  await addBox(page).fill("renew passport tomorrow");
  await addBox(page).press("Enter");
  await expect(itemRow(page, "renew passport")).toBeVisible();
  const settings = await openSettings(page);
  await option(field(settings, "sort by"), "deadline").click();
  await saveSettings(settings);
  await expect(page.getByText("no date").first()).toBeAttached();

  const page_ = await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement;
    const se = document.scrollingElement as HTMLElement;
    const escaping = [...main.querySelectorAll("*")].filter((el) => {
      const style = getComputedStyle(el);
      if (style.position !== "absolute" || style.display === "none") return false;
      const anchor = (el as HTMLElement).offsetParent;
      return !anchor || !main.contains(anchor);
    });
    return { room: se.scrollHeight - se.clientHeight, escaping: escaping.length };
  });
  expect(page_).toEqual({ room: 0, escaping: 0 });
});
