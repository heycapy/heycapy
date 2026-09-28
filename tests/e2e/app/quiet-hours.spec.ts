import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("quiet-hours") });

async function quietHoursBox(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("quiet hours", { exact: true }) })
    .last();
}

test("quiet hours are off by default, and turning them on is saved", async ({ page }) => {
  let box = await quietHoursBox(page);
  await expect(box.getByText("reminders and alerts can arrive at any time")).toBeVisible();

  await box.getByRole("button", { name: "on", exact: true }).click();
  await expect(
    box.getByText("nothing is sent 10pm–7am, on any channel; reminders due then arrive at 7am")
  ).toBeVisible();
  await box.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(box.getByText("saved ✓")).toBeVisible();

  box = await quietHoursBox(page);
  await expect(box.getByText(/nothing is sent 10pm–7am/)).toBeVisible();
  await box.getByRole("button", { name: "off", exact: true }).click();
  await box.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(box.getByText("reminders and alerts can arrive at any time")).toBeVisible();
});
