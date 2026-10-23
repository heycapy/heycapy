import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, uniqueName } from "../helpers/buckets";
import { openSettings, switchTab } from "../helpers/settings";

test.use({ storageState: authState("dialogs") });

async function makePageScrollable(page: Page) {
  await page.locator("main").evaluate((main) => {
    const filler = document.createElement("div");
    filler.style.minHeight = "4000px";
    filler.style.flexShrink = "0";
    main.appendChild(filler);
  });
}

async function expectPageStill(page: Page) {
  const scrollTop = () => page.locator("main").evaluate((main) => main.scrollTop);
  const before = await scrollTop();
  const { height } = page.viewportSize() ?? { height: 720 };
  for (const [x, y] of [
    [5, 5],
    [5, height - 5],
  ]) {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 1500);
  }
  await page.waitForTimeout(200);
  expect(await scrollTop()).toBe(before);
}

async function expectFocusInside(page: Page, dialog: Locator) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
}

async function expectModal(page: Page, dialog: Locator, opener: Locator) {
  await expect(dialog).toBeVisible();
  await expectPageStill(page);
  await expectFocusInside(page, dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
}

async function openFromMenu(page: Page, name: string | RegExp) {
  await page.goto("/");
  await makePageScrollable(page);
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name, exact: typeof name === "string" }).click();
  return page.getByRole("button", { name: "···" });
}

const FROM_MENU: [string | RegExp, string][] = [
  [/^what's new/, "what's new"],
  ["feedback", "feedback"],
  ["tweaks", "tweaks"],
  ["join a bucket", "join a bucket"],
  ["archived", "archived buckets"],
  ["trash", "trash"],
  ["logout", "log out?"],
];

for (const [item, name] of FROM_MENU) {
  test(`${name} keeps the page behind it still and keeps focus`, async ({ page }) => {
    const opener = await openFromMenu(page, item);
    await expectModal(page, page.getByRole("dialog", { name }), opener);
  });
}

test("escape closes the schema editor first, then bucket settings", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Dialogs"));
  await openSettings(page);
  const settings = page.getByRole("dialog", { name: /^bucket settings \[/ });
  await switchTab(settings, "advanced");
  await settings.getByRole("button", { name: "[ configure schema ]" }).click();

  const schema = page.getByRole("dialog", { name: /^schema \[/ });
  await expect(schema).toBeVisible();
  await expectFocusInside(page, schema);

  await page.keyboard.press("Escape");
  await expect(schema).toBeHidden();
  await expect(settings).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
});

test("search keeps the page behind it still", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Dialogs"));
  await makePageScrollable(page);
  const opener = page.getByRole("button", { name: "[ search ]", exact: true });
  await opener.click();
  const search = page.getByRole("dialog", { name: "search" });
  await expect(search.getByRole("textbox", { name: "search all items" })).toBeFocused();
  await expectModal(page, search, opener);
});

test("a click above the search drawer closes it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Dialogs"));
  await page.getByRole("button", { name: "[ search ]", exact: true }).click();
  const search = page.getByRole("dialog", { name: "search" });
  await expect(search.getByRole("textbox", { name: "search all items" })).toBeFocused();
  // Radix lets clicks reach the modal one frame after it appears, too soon for a person to notice
  await expect(page.locator("[data-modal-panel]")).toHaveCSS("pointer-events", "auto");
  await page.mouse.click(5, 5);
  await expect(search).toHaveCount(0);
});
