import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("no-channel") });

function banner(page: Page) {
  return page.getByRole("alert").filter({ hasText: "no notification channel works" });
}

async function openNotifications(page: Page) {
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("email", { exact: true }) })
    .last();
}

async function setEmail(page: Page, on: boolean) {
  const email = await openNotifications(page);
  await email
    .getByRole("button", { name: on ? "on" : "off", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "[ save ]" }).click();
  await expect(page.getByRole("button", { name: "[ save ]" })).not.toBeVisible();
}

test("warns app-wide once no channel works, and goes away when one does", async ({ page }) => {
  await page.goto("/");
  await expect(banner(page)).not.toBeVisible();

  await setEmail(page, false);
  await expect(banner(page)).toBeVisible();

  await banner(page).getByRole("button", { name: "[ set up ]" }).click();
  await expect(page.getByText("ntfy (push)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "[ x ]" }).first().click();

  await setEmail(page, true);
  await expect(banner(page)).not.toBeVisible();
});
