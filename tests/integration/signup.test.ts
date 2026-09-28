import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createOtp } from "@/lib/auth/otp";
import { verifyOtpAction } from "@/app/(auth)/login/actions";

const createContact = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock("resend", () => ({
  Resend: class {
    contacts = { create: createContact };
  },
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  createSession: async () => {},
}));

const previousKey = process.env.RESEND_API_KEY;
beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
});
afterEach(() => {
  process.env.RESEND_API_KEY = previousKey;
  createContact.mockClear();
});

it("signing up never adds the email to the Resend contact list", async () => {
  const email = "new-signup@heycapy.test";
  const code = await createOtp(email);

  expect(await verifyOtpAction(email, code)).toEqual({ ok: true });

  expect(await db.query.users.findFirst({ where: eq(users.email, email) })).toBeDefined();
  expect(createContact).not.toHaveBeenCalled();
});
