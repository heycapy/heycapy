import { test, expect } from "@playwright/test";

test("an email reminder link opens without logging in and refuses a bad token", async ({
  page,
}) => {
  const res = await page.goto("/r/not.a-real-token");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/r\/not\.a-real-token$/);
  await expect(page.getByText("this link has expired — open heycapy instead")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});
