import { NextResponse } from "next/server";
import { Resend } from "resend";
import { APP_DOMAIN, APP_EMAIL_FROM } from "@/constants";

// the website (a separate static site on the root domain) posts its feedback form here
const SITE_ORIGIN = `https://${APP_DOMAIN}`;

function corsHeaders(request: Request): Record<string, string> {
  if (request.headers.get("origin") !== SITE_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const { message, email } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400, headers });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503, headers });
  }

  const feedbackEmail = process.env.FEEDBACK_EMAIL;
  if (!feedbackEmail) {
    return NextResponse.json({ error: "Feedback not configured" }, { status: 503, headers });
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
    return NextResponse.json({ error: error.message }, { status: 500, headers });
  }

  return NextResponse.json({ success: true }, { headers });
}
