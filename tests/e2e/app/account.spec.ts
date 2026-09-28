import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authState, specUserEmail } from "../helpers/auth";

test.use({ storageState: authState("account") });
test.describe.configure({ mode: "serial" });

async function openAccountTab(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
}

test("download my data gives a JSON file with the account in it", async ({ page }) => {
  await openAccountTab(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "[download my data]" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^heycapy-export-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync((await download.path()) ?? "", "utf8")) as {
    account: { email: string };
    buckets: unknown[];
  };
  expect(data.account.email).toBe(specUserEmail("account"));
  expect(Array.isArray(data.buckets)).toBe(true);
});

test("the system tab is only for admins", async ({ page }) => {
  await openAccountTab(page);
  await expect(page.getByRole("button", { name: "system", exact: true })).toHaveCount(0);
});

test("deleting the account needs the emailed code, then ends at the login page", async ({
  page,
}) => {
  await openAccountTab(page);

  await page.getByRole("button", { name: /delete account/ }).click();
  await expect(page.getByText(/it can't be undone/)).toBeVisible();
  await page.getByRole("button", { name: /email me a code/ }).click();

  const devCode = (await page.getByText(/^dev code: \d{6}$/).textContent())?.slice(-6) ?? "";
  const input = page.getByRole("textbox", { name: "deletion code" });
  await input.fill("000000");
  await page.getByRole("button", { name: /delete forever/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong or expired code." })).toBeVisible();

  await input.fill(devCode);
  await page.getByRole("button", { name: /delete forever/ }).click();
  await expect(page).toHaveURL(/\/login$/);
});
