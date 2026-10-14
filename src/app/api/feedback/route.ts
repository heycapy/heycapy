import { NextResponse } from "next/server";
import { APP_DOMAIN } from "@/constants";
import { sendFeedback } from "@/lib/feedback";

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

  const text = email?.trim() ? `${message.trim()}\n\n— ${email.trim()}` : message.trim();
  const result = await sendFeedback({ text });

  if (!result.ok && result.reason === "not_configured") {
    return NextResponse.json({ error: "Feedback not configured" }, { status: 503, headers });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500, headers });
  }

  return NextResponse.json({ success: true }, { headers });
}
