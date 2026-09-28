import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("logout-everywhere") });

test("log out everywhere ends the session in every browser", async ({ page, browser }) => {
  const otherDevice = await browser.newContext({ storageState: authState("logout-everywhere") });
  const other = await otherDevice.newPage();
  await other.goto("/");
  await expect(other.getByRole("button", { name: "···" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "logout everywhere" }).click();
  await expect(
    page.getByText("ends your sessions on every device, including this one.")
  ).toBeVisible();
  await page.getByRole("button", { name: /log out everywhere/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await other.goto("/");
  await expect(other).toHaveURL(/\/login$/);
  await otherDevice.close();
});
