import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Random too: parallel tests can start in the same millisecond and would share an account
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@heycapy.test`;
}

// Usernames are unique across all accounts and only take a-z, 0-9 and _
export function uniqueUsername(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

// Both steps stay mounted and fade via opacity, so check opacity, not visibility
export function emailStep(page: Page) {
  return page.locator("form").filter({ has: page.getByText("Enter your email") });
}

export function otpStep(page: Page) {
  return page.locator("form").filter({ has: page.getByText("Check your email") });
}

export async function sendCode(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(otpStep(page)).toHaveCSS("opacity", "1");
}

export async function readDevCode(page: Page): Promise<string> {
  // Shown on screen in E2E_TEST_MODE
  const devCode = page.locator(".font-semibold.tracking-widest");
  await expect(devCode).toHaveText(/^\d{6}$/);
  return (await devCode.textContent()) ?? "";
}

export async function enterCode(page: Page, code: string): Promise<void> {
  await otpStep(page).locator("input").first().click();
  await page.keyboard.type(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function login(page: Page, email: string): Promise<void> {
  await sendCode(page, email);
  await enterCode(page, await readDevCode(page));
  await page.waitForURL("/");
}
