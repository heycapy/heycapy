import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("feedback") });

test("feedback is sent from the menu and the dialog says thanks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "feedback", exact: true }).click();

  const send = page.getByRole("button", { name: /^\[\s*send\s*\]$/ });
  await expect(
    page.getByText("the page you're on, the app version and your browser")
  ).toBeVisible();
  await expect(send).toBeDisabled();

  await page.getByRole("textbox", { name: "feedback" }).fill("the trash won't open");
  await send.click();

  await expect(page.getByRole("status").filter({ hasText: "got it. thanks." })).toBeVisible();
  await page.getByRole("button", { name: /^\[\s*close\s*\]$/ }).click();
  await expect(page.getByText("got it. thanks.")).toHaveCount(0);

  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "feedback", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "feedback" })).toHaveValue("");
});
