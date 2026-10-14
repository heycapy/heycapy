import { Resend } from "resend";
import { APP_EMAIL_FROM, FEEDBACK_SUBJECT } from "@/constants";
import { isE2ETestMode } from "@/lib/e2e";

export type FeedbackResult =
  { ok: true } | { ok: false; reason: "not_configured" | "failed"; error?: string };

export function feedbackConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.FEEDBACK_EMAIL;
}

export async function sendFeedback(feedback: {
  text: string;
  replyTo?: string;
}): Promise<FeedbackResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const feedbackEmail = process.env.FEEDBACK_EMAIL;
  if (!resendKey || !feedbackEmail) return { ok: false, reason: "not_configured" };
  if (isE2ETestMode()) return { ok: true };

  const { error } = await new Resend(resendKey).emails.send({
    from: process.env.EMAIL_FROM ?? APP_EMAIL_FROM,
    to: feedbackEmail,
    subject: FEEDBACK_SUBJECT,
    text: feedback.text,
    ...(feedback.replyTo ? { replyTo: feedback.replyTo } : {}),
  });
  return error ? { ok: false, reason: "failed", error: error.message } : { ok: true };
}
