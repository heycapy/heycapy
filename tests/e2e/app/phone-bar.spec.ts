import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItemButton, openBucketOnPhone, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("phone-bar"), hasTouch: true });

test("the place switcher goes to today and starts new buckets; today has no add", async ({
  page,
}) => {
  const bucket = uniqueName("Switcher");
  await openBucketOnPhone(page, bucket);

  await page.getByRole("button", { name: bucket, exact: true }).tap();
  const picker = page.getByRole("dialog", { name: "go to" });
  await picker.getByRole("button", { name: "today", exact: true }).tap();
  await expect(picker).not.toBeVisible();
  await expect(addItemButton(page)).toHaveCount(0);

  await page.getByRole("button", { name: "today", exact: true }).tap();
  await picker.getByRole("button", { name: bucket, exact: true }).tap();
  await expect(addItemButton(page)).toHaveCount(1);

  await page.getByRole("button", { name: bucket, exact: true }).tap();
  await picker.getByRole("button", { name: "new bucket" }).tap();
  await expect(page.getByRole("button", { name: /^Blank/ })).toBeVisible();
});

test("the capy sprite in the bottom bar opens the chat in place of the floating sprite", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Capy"));
  await expect(page.getByRole("button", { name: "Open chat" })).toBeHidden();

  await page.getByRole("button", { name: "chat with capy" }).tap();
  await expect(page.getByText("am capy")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("button", { name: "chat with capy" })).toBeHidden();
});
