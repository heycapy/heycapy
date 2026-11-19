import { test, expect, type Page } from "@playwright/test";
import { login, uniqueEmail } from "../helpers/login";
import { field, openSettings, option, saveSettings } from "../helpers/settings";
import {
  inlineEditor,
  openEditForm,
  addItem,
  addItemButton,
  createAndSelectBucket,
  itemRow,
  newItemForm,
  openDetail,
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

test("editing the bottom row brings it above the edit form", async ({ page }) => {
  await bucketWithItems(page);
  await openEditForm(page, "eight");
  await expect(inlineEditor(page)).toBeInViewport({ ratio: 1 });
});

test("a long list sorted by deadline never makes the page itself taller", async ({ page }) => {
  test.setTimeout(90_000);
  await bucketWithItems(page, 18);
  await addItemButton(page).click();
  const form = newItemForm(page);
  await form.locator("textarea").first().fill("renew passport");
  await openDetail(form, "date");
  await page.getByRole("button", { name: "tomorrow", exact: true }).click();
  await form.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, "renew passport")).toBeVisible();
  const settings = await openSettings(page);
  await option(field(settings, "sort by"), "deadline").click();
  await saveSettings(settings);
  await expect(page.getByText("tomorrow").first()).toBeAttached();

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
