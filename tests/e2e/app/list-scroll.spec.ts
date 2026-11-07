import { test, expect, type Page } from "@playwright/test";
import { login, uniqueEmail } from "../helpers/login";
import {
  addItem,
  addItemButton,
  createAndSelectBucket,
  itemRow,
  newItemForm,
  uniqueName,
} from "../helpers/buckets";

const TITLES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

async function bucketWithItems(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, uniqueEmail("e2e-list-scroll"));
  await createAndSelectBucket(page, uniqueName("scroll"));
  for (const title of TITLES) await addItem(page, title);
}

function scrollRoom(page: Page) {
  return page.locator("main").evaluate((el) => el.scrollHeight - el.clientHeight);
}

test("a list that fits has no empty space to scroll into", async ({ page }) => {
  await bucketWithItems(page);
  expect(await scrollRoom(page)).toBeLessThanOrEqual(0);
});

test("with the add form open, the list only scrolls as far as the form covers it", async ({
  page,
}) => {
  await bucketWithItems(page);
  await addItemButton(page).click();
  const form = newItemForm(page);
  await expect(form.locator("textarea").first()).toBeFocused();
  await expect
    .poll(async () => {
      const panelTop = (await page.locator("[data-item-panel]").boundingBox())?.y ?? 0;
      const last = await itemRow(page, "eight").boundingBox();
      const hidden = Math.max(0, (last?.y ?? 0) + (last?.height ?? 0) - panelTop);
      return (await scrollRoom(page)) - hidden;
    })
    .toBeLessThanOrEqual(16);
});

test("a bottom row can still be scrolled above an open edit panel", async ({ page }) => {
  await bucketWithItems(page);
  await itemRow(page, "eight").click();
  const panel = page.locator("[data-item-panel]");
  await expect(panel).toBeVisible();
  await page.mouse.move(640, 200);
  await page.mouse.wheel(0, 2000);
  await expect
    .poll(async () => {
      const row = await itemRow(page, "eight").boundingBox();
      const top = (await panel.boundingBox())?.y ?? 0;
      return (row?.y ?? Infinity) + (row?.height ?? 0) <= top;
    })
    .toBe(true);
});
