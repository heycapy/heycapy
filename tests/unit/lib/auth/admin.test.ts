import { afterEach, expect, it } from "vitest";
import { isAdmin } from "@/lib/auth/admin";

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

it("reads a comma-separated list, ignoring case and spaces", () => {
  process.env.ADMIN_EMAILS = " Me@Example.com , ops@example.com,";
  expect(isAdmin("me@example.com")).toBe(true);
  expect(isAdmin("OPS@example.com")).toBe(true);
  expect(isAdmin("someone@example.com")).toBe(false);
});

it("nobody is an admin when it isn't set", () => {
  expect(isAdmin("me@example.com")).toBe(false);
});
