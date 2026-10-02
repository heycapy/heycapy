import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { servedOverHttps } from "./https";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "./constants";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: number;
  email: string;
};

// sv: the user's session version when the token was issued
type TokenPayload = SessionPayload & { sv?: number };

export function signSessionToken(payload: SessionPayload & { sv: number }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret());
}

async function currentSessionVersion(userId: number): Promise<number | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { sessionVersion: true },
  });
  return user?.sessionVersion ?? null;
}

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken({
    ...payload,
    sv: (await currentSessionVersion(payload.userId)) ?? 1,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: servedOverHttps(await headers()),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

// A valid signature, issued under the user's current session version
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  let payload: TokenPayload;
  try {
    payload = (await jwtVerify(token, getSecret())).payload as unknown as TokenPayload;
  } catch {
    return null;
  }
  // Tokens from before session versions existed count as version 1
  if ((payload.sv ?? 1) !== (await currentSessionVersion(payload.userId))) return null;
  return { userId: payload.userId, email: payload.email };
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireApiSession(): Promise<[SessionPayload, null] | [null, Response]> {
  const session = await getSession();
  if (!session) return [null, new Response("Unauthorized", { status: 401 })];
  return [session, null];
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
