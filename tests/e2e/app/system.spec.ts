import { test, expect } from "@playwright/test";
import { authState, specUserEmail } from "../helpers/auth";

test.use({ storageState: authState("system") });

test("the system tab shows the scheduler to admins", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "✓ running" })).toBeVisible();
  await expect(page.getByText("recent errors", { exact: true })).toBeVisible();
});

test("admins give a user credits from the system tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await page.getByLabel("user email").fill(specUserEmail("system"));
  await page.getByRole("button", { name: "look up" }).click();
  const balance = page.getByText(/^\d+ credits$/);
  await expect(balance).toBeVisible();
  const before = Number((await balance.textContent())?.match(/(\d+) credits/)?.[1]);

  await page.getByLabel("credits to give").fill("5");
  await page.getByLabel("note").fill("e2e thanks");
  await page.getByRole("button", { name: "give" }).click();

  await expect(page.getByText(`${before + 5} credits`, { exact: true })).toBeVisible();
  await expect(
    page.getByText(/\d+ granted · \d+ used · \d+ refunded · \d+ taken back · \d+ by admins/)
  ).toBeVisible();
  await expect(page.getByText(/^last 30 days · \d+ used · \$\d+\.\d{4} on our ai/)).toBeVisible();

  const activity = page.getByText("e2e thanks · by e2e-system@heycapy.test").first();
  await expect(activity).toBeHidden();
  await page.getByRole("button", { name: "show activity" }).click();
  await expect(activity).toBeVisible();
});
