import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seed } from "@/lib/db/seed";

const schema = z.object({
  email: z.email(),
  code: z.string().length(OTP_LENGTH),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, code } = result.data;
  const valid = await verifyOtp(email, code);

  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // get or create user
  let user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user) {
    const [created] = await db.insert(users).values({ email }).returning();
    user = created;
    await db.insert(userSettings).values({ userId: user.id });
    await seed(user.id);
  }

  await createSession({ userId: user.id, email: user.email });

  return NextResponse.json({ ok: true });
}
