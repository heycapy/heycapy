import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("push") });

async function openPushSettings(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("push", { exact: true }) })
    .last();
}

test("push can be turned on for this device from tweaks", async ({ page }) => {
  const push = await openPushSettings(page);
  await expect(push.getByText("this device", { exact: true })).toBeVisible();
  await expect(push.getByText("off", { exact: true })).toBeVisible();
  await expect(push.getByRole("button", { name: "[turn on]" })).toBeEnabled();
  await expect(push.getByText("devices", { exact: true })).toHaveCount(0);
});
