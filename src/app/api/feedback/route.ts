import { NextResponse } from "next/server";
import { Resend } from "resend";
import { APP_EMAIL_FROM } from "@/constants";

export async function POST(request: Request) {
  const { message, email } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const feedbackEmail = process.env.FEEDBACK_EMAIL;
  if (!feedbackEmail) {
    return NextResponse.json({ error: "Feedback not configured" }, { status: 503 });
  }

  const from = process.env.EMAIL_FROM ?? APP_EMAIL_FROM;
  const body = email?.trim() ? `${message.trim()}\n\n— ${email.trim()}` : message.trim();

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: feedbackEmail,
    subject: "feedback from heycapy",
    text: body,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
