import { NextResponse } from "next/server";
import { z } from "zod";
import {
  APP_DOMAIN,
  FEEDBACK_EMAIL_MAX_LENGTH,
  FEEDBACK_LIMIT_PER_IP,
  FEEDBACK_LIMIT_SITE_TOTAL,
  FEEDBACK_MAX_LENGTH,
} from "@/constants";
import { allowFeedback, sendFeedback } from "@/lib/feedback";

const SiteFeedback = z.object(
  {
    message: z
      .string("Message is required")
      .trim()
      .min(1, "Message is required")
      .max(FEEDBACK_MAX_LENGTH, "Message is too long"),
    email: z.string().trim().max(FEEDBACK_EMAIL_MAX_LENGTH, "Email is too long").optional(),
  },
  "Invalid request"
);

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

// Fly's proxy sets Fly-Client-IP itself, the last X-Forwarded-For entry is the one the nearest proxy added
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return request.headers.get("fly-client-ip") ?? (forwarded || "unknown");
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const parsed = SiteFeedback.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const error = parsed.error.issues[0].message;
    return NextResponse.json({ error }, { status: 400, headers });
  }
  const { message, email } = parsed.data;

  const allowed = allowFeedback([
    { key: `ip:${clientIp(request)}`, max: FEEDBACK_LIMIT_PER_IP },
    { key: "site", max: FEEDBACK_LIMIT_SITE_TOTAL },
  ]);
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages" }, { status: 429, headers });
  }

  const text = email ? `${message}\n\n— ${email}` : message;
  const result = await sendFeedback({ text });

  if (!result.ok && result.reason === "not_configured") {
    return NextResponse.json({ error: "Feedback not configured" }, { status: 503, headers });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500, headers });
  }

  return NextResponse.json({ success: true }, { headers });
}
