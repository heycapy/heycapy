import { afterAll, beforeAll, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signSessionToken, verifySessionToken } from "@/lib/auth/session";
import { seedUser } from "./helpers";

const previousSecret = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
});
afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
});

async function logOutEverywhere(userId: number) {
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
}

it("a session issued under the current version works until logging out everywhere", async () => {
  const userId = await seedUser();
  const token = await signSessionToken({ userId, email: "a@heycapy.test", sv: 1 });
  expect(await verifySessionToken(token)).toEqual({ userId, email: "a@heycapy.test" });

  await logOutEverywhere(userId);

  expect(await verifySessionToken(token)).toBeNull();
  const fresh = await signSessionToken({ userId, email: "a@heycapy.test", sv: 2 });
  expect(await verifySessionToken(fresh)).toEqual({ userId, email: "a@heycapy.test" });
});

it("sessions from before versions existed keep working, and end with the first bump", async () => {
  const userId = await seedUser();
  const legacy = await new SignJWT({ userId, email: "a@heycapy.test" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  expect(await verifySessionToken(legacy)).not.toBeNull();

  await logOutEverywhere(userId);

  expect(await verifySessionToken(legacy)).toBeNull();
});

it("refuses a forged token or one for a user that no longer exists", async () => {
  const forged = await new SignJWT({ userId: 1, email: "x", sv: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("some-other-secret-that-is-long-enough"));
  expect(await verifySessionToken(forged)).toBeNull();

  const gone = await signSessionToken({ userId: 999_999, email: "x", sv: 1 });
  expect(await verifySessionToken(gone)).toBeNull();
});
