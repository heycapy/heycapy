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
