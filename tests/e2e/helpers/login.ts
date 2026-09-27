import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@heycapy.test`;
}

// Both login steps stay mounted and are cross-faded with opacity, so visibility
// checks can't tell them apart — assert the rendered opacity instead.
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
  // The server shows the code on screen when running with E2E_TEST_MODE=1
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
