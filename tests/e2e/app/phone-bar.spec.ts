import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItemButton, openBucketOnPhone, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("phone-bar"), hasTouch: true });

test("the place switcher goes to today and starts new buckets; add works in both", async ({
  page,
}) => {
  const bucket = uniqueName("Switcher");
  await openBucketOnPhone(page, bucket);

  await page.getByRole("button", { name: bucket, exact: true }).tap();
  const picker = page.getByRole("dialog", { name: "go to" });
  await picker.getByRole("button", { name: "today", exact: true }).tap();
  await expect(picker).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "today" })).toBeVisible();
  await expect(addItemButton(page)).toHaveCount(1);

  await page.getByRole("button", { name: "today", exact: true }).tap();
  await picker.getByRole("button", { name: bucket, exact: true }).tap();
  await expect(addItemButton(page)).toHaveCount(1);

  await page.getByRole("button", { name: bucket, exact: true }).tap();
  await picker.getByRole("button", { name: "new bucket" }).tap();
  await expect(page.getByRole("button", { name: /^Blank/ })).toBeVisible();
});

test("capy in the bottom bar opens the chat as a drawer on phones", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Capy"));
  await expect(page.getByRole("button", { name: "Open chat" })).toBeHidden();

  await page.getByRole("button", { name: "chat with capy" }).tap();
  const chat = page.getByRole("dialog", { name: "chat with capy" });
  await expect(chat.getByText("am capy")).toBeVisible();
  await expect(chat.getByPlaceholder("ask capy...")).not.toBeFocused();
  await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBe(0);

  await chat.getByRole("button", { name: "[ history ]", exact: true }).tap();
  await expect(chat.getByText("chat history", { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "[ x ]", exact: true }).tap();
  await expect(chat.getByText("chat history", { exact: true })).toBeHidden();
  await expect(chat).toBeVisible();

  await page.touchscreen.tap(195, 60);
  await expect(chat).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("button", { name: "chat with capy" })).toBeHidden();
});

test("the bottom bar is easy to tap and clear of the screen's rounded bottom", async ({ page }) => {
  const bucket = uniqueName("Sizes");
  await openBucketOnPhone(page, bucket);
  const screenHeight = page.viewportSize()?.height ?? 0;

  for (const control of [
    page.getByRole("button", { name: bucket, exact: true }),
    addItemButton(page),
    page.getByRole("button", { name: "[ search ]", exact: true }),
    page.getByRole("button", { name: "chat with capy" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(screenHeight - 8);
  }
});

test("search opens as a drawer with the box at the bottom, results above it", async ({ page }) => {
  const bucket = uniqueName("Find");
  await openBucketOnPhone(page, bucket);
  const title = uniqueName("lost keys");
  await addItemButton(page).tap();
  const form = page.getByRole("dialog", { name: "new item" });
  await form.locator("textarea").first().fill(title);
  await form.getByRole("button", { name: "[ add ]", exact: true }).tap();
  await expect(form).toBeHidden();

  await page.getByRole("button", { name: "[ search ]", exact: true }).tap();
  const search = page.getByRole("dialog", { name: "search" });
  const box = search.getByRole("textbox", { name: "search all items" });
  await expect(box).toBeFocused();
  await box.fill(title);
  const row = search.getByRole("button", { name: title });
  await expect(row).toBeVisible();

  const rowBox = await row.boundingBox();
  const inputBox = await box.boundingBox();
  const screenHeight = page.viewportSize()?.height ?? 0;
  expect((rowBox?.y ?? 0) + (rowBox?.height ?? 0)).toBeLessThanOrEqual(inputBox?.y ?? 0);
  expect((inputBox?.y ?? 0) + (inputBox?.height ?? 0)).toBeGreaterThan(screenHeight - 80);

  await row.tap();
  const edit = page.getByRole("dialog", { name: "edit item" });
  await edit.getByRole("button", { name: "[ cancel ]", exact: true }).tap();
  await expect(edit).toBeHidden();
  await expect(search).toBeVisible();

  await page.touchscreen.tap(195, 60);
  await expect(search).toHaveCount(0);

  await page.getByRole("button", { name: "[ search ]", exact: true }).tap();
  await expect(search).toBeVisible();
  const header = await search.getByText("search every bucket").boundingBox();
  const x = (header?.x ?? 0) + 40;
  const y = (header?.y ?? 0) + 5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x, y + step * 25);
  await page.mouse.up();
  await expect(search).toHaveCount(0);
});
