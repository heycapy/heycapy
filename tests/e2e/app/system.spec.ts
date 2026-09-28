import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("system") });

test("the system tab shows the scheduler to admins", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "✓ running" })).toBeVisible();
  await expect(page.getByText("recent errors", { exact: true })).toBeVisible();
});
