import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({
  storageState: authState("telegram-connect"),
  permissions: ["clipboard-read", "clipboard-write"],
});

async function openTelegramSettings(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("telegram", { exact: true }) })
    .last();
}

const LINK = /^https:\/\/t\.me\/heycapy_test_bot\?start=[A-Za-z0-9_-]{32}$/;

test("connect shows a one-time link that can be copied", async ({ page }) => {
  const telegram = await openTelegramSettings(page);
  await expect(telegram.getByText("not connected")).toBeVisible();

  await telegram.getByRole("button", { name: "[connect]" }).click();
  const link = telegram.getByRole("textbox", { name: "telegram connect link" });
  await expect(link).toHaveValue(LINK);
  await expect(telegram.getByRole("img", { name: "scan to connect telegram" })).toBeVisible();
  await expect(telegram.getByRole("link", { name: "open in telegram" })).toHaveAttribute(
    "href",
    await link.inputValue()
  );

  await telegram.getByRole("button", { name: "[copy]" }).click();
  await expect(telegram.getByRole("button", { name: "[copied]" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await link.inputValue());
});

test("connecting again gives a new link", async ({ page }) => {
  const telegram = await openTelegramSettings(page);
  const link = telegram.getByRole("textbox", { name: "telegram connect link" });

  await telegram.getByRole("button", { name: "[connect]" }).click();
  await expect(link).toHaveValue(LINK);
  const first = await link.inputValue();
  await telegram.getByRole("button", { name: "[connect]" }).click();
  await expect(link).not.toHaveValue(first);
  await expect(link).toHaveValue(LINK);
});
