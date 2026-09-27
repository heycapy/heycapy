import { test, expect } from "@playwright/test";

test.describe("public pages", () => {
  test("home page renders branding and nav links", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "heycapy" })).toBeVisible();
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /about/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /how to use/i })).toBeVisible();
  });

  test("home page has correct title", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveTitle(/heycapy/i);
  });

  test("about page loads and shows content", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "about" })).toBeVisible();
    await expect(page.getByText(/self-hosted/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /github/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /how to use/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /open app/i })).toBeVisible();
  });

  test("about page back link is present and points to root", async ({ page }) => {
    await page.goto("/about");
    const backLink = page.getByRole("link", { name: /back/i });
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute("href");
    expect(href).toBe("/");
  });

  test("how-to-use page loads", async ({ page }) => {
    await page.goto("/how-to-use");
    await expect(page).toHaveURL("/how-to-use");
    await expect(page.locator("main")).toBeVisible();
  });
});
