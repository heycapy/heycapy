import { test, expect } from "@playwright/test";
import {
  emailStep,
  enterCode,
  login,
  otpStep,
  readDevCode,
  sendCode,
  uniqueEmail,
} from "../helpers/login";

test.describe("login page", () => {
  test("renders sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(emailStep(page)).toHaveCSS("opacity", "1");
    await expect(otpStep(page)).toHaveCSS("opacity", "0");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send code", exact: true })).toBeVisible();
  });

  test("only the active step can take focus", async ({ page }) => {
    // The hidden step is `inert`; Playwright's role queries ignore inert, so assert focus instead
    const signIn = page.getByRole("button", { name: "Sign in", exact: true });
    const sendCodeButton = page.getByRole("button", { name: "Send code", exact: true });

    await page.goto("/login");
    await signIn.focus();
    await expect(signIn).not.toBeFocused();

    await sendCode(page, uniqueEmail("e2e-inert"));
    await sendCodeButton.focus();
    await expect(sendCodeButton).not.toBeFocused();
    await page.getByPlaceholder("you@example.com").focus();
    await expect(page.getByPlaceholder("you@example.com")).not.toBeFocused();
  });

  test("keeps focus on the email field for an invalid email", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("notanemail");
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByPlaceholder("you@example.com")).toBeFocused();
    await expect(otpStep(page)).toHaveCSS("opacity", "0");
  });

  test("transitions to the OTP step after sending a code", async ({ page }) => {
    const email = uniqueEmail("e2e-transition");
    await sendCode(page, email);
    await expect(emailStep(page)).toHaveCSS("opacity", "0");
    await expect(otpStep(page).getByText(email)).toBeVisible();
  });

  test("shows resend countdown after sending a code", async ({ page }) => {
    await sendCode(page, uniqueEmail("e2e-resend"));
    await expect(page.getByText(/Resend in/)).toBeVisible();
  });

  test("going back returns to the email step", async ({ page }) => {
    await sendCode(page, uniqueEmail("e2e-back"));
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(emailStep(page)).toHaveCSS("opacity", "1");
    await expect(otpStep(page)).toHaveCSS("opacity", "0");
  });

  test("rejects a wrong code", async ({ page }) => {
    await sendCode(page, uniqueEmail("e2e-wrong-code"));
    const code = await readDevCode(page);
    const wrong = code === "000000" ? "111111" : "000000";
    await enterCode(page, wrong);
    await expect(otpStep(page).getByText("Invalid or expired code. Try again.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("completes full login flow and lands on app", async ({ page }) => {
    await login(page, uniqueEmail("e2e-login"));
    await expect(page).toHaveURL("/");
  });

  test("after a right code the button keeps spinning and nothing is clickable until the app opens", async ({
    page,
  }) => {
    await sendCode(page, uniqueEmail("e2e-slow-app"));
    const code = await readDevCode(page);
    // the live server takes a second or more to send the app page; hold it back so the wait shows
    let releaseApp = () => {};
    const appHeld = new Promise<void>((resolve) => (releaseApp = resolve));
    await page.route("**/*", async (route) => {
      const request = route.request();
      const isAppPage = request.method() === "GET" && new URL(request.url()).pathname === "/";
      if (isAppPage && request.headers()["rsc"]) await appHeld;
      await route.continue();
    });

    const codeChecked = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"
    );
    await enterCode(page, code);
    await codeChecked;
    await page.waitForTimeout(300);

    await expect(page).toHaveURL(/\/login/);
    // while it spins the label is hidden, so find it by place, not name
    await expect(otpStep(page).locator('button[type="submit"]')).toBeDisabled();
    await expect(otpStep(page).locator("input").first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Use a different email" })).toBeDisabled();

    releaseApp();
    await page.waitForURL("/");
  });

  test("over plain http the login cookie isn't https-only, so every browser keeps it", async ({
    page,
    context,
  }) => {
    await login(page, uniqueEmail("e2e-http-cookie"));
    const session = (await context.cookies()).find((c) => c.name === "heycapy_session");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", secure: false });
  });

  test("redirects to login when accessing app unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
