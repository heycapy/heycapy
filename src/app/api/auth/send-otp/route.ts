import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { createOtp } from "@/lib/auth/otp";
import { APP_NAME, APP_EMAIL_FROM } from "@/constants";
import { OTP_TTL_MINUTES } from "@/lib/auth/constants";

const schema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = result.data;
  const configuredEmail = process.env.EMAIL;

  if (!configuredEmail || email !== configuredEmail) {
    // Don't reveal whether the email is wrong — same response either way
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const code = await createOtp(email);

    await resend.emails.send({
      from: APP_EMAIL_FROM,
      to: email,
      subject: `Your ${APP_NAME} login code: ${code}`,
      text: `Your login code is: ${code}\n\nIt expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
