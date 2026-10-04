import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { codesShownOnScreen } from "@/lib/auth/otp";

beforeEach(() => {
  vi.stubEnv("E2E_TEST_MODE", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_HOST", "");
});
afterEach(() => vi.unstubAllEnvs());

it("shows codes on screen without email only in development or on this machine", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(codesShownOnScreen()).toBe(true);

  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "http://localhost");
  expect(codesShownOnScreen()).toBe(true);

  vi.stubEnv("APP_URL", "https://heycapy.example.com");
  expect(codesShownOnScreen()).toBe(false);
});

it("never shows codes once email is set up", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("RESEND_API_KEY", "re_live");
  expect(codesShownOnScreen()).toBe(false);
});
