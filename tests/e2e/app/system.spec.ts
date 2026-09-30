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
  const balance = page.getByText(/^e2e-system@heycapy\.test · \d+ credits$/);
  await expect(balance).toBeVisible();
  const before = Number((await balance.textContent())?.match(/(\d+) credits/)?.[1]);

  await page.getByLabel("credits to give").fill("5");
  await page.getByLabel("note").fill("e2e thanks");
  await page.getByRole("button", { name: "give" }).click();

  await expect(page.getByText(`e2e-system@heycapy.test · ${before + 5} credits`)).toBeVisible();
  await expect(
    page.getByText(/admin · e2e thanks · by e2e-system@heycapy\.test/).first()
  ).toBeVisible();
});
