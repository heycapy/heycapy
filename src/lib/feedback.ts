import { Resend } from "resend";
import { APP_EMAIL_FROM, FEEDBACK_LIMIT_WINDOW_MS, FEEDBACK_SUBJECT } from "@/constants";
import { isE2ETestMode } from "@/lib/e2e";
import { buildFeedbackThanksEmail } from "@/lib/email/feedbackThanks";
import { sendEmail } from "@/lib/notifications/email";
import { recordSystemError } from "@/lib/system-errors";

export type FeedbackResult =
  { ok: true } | { ok: false; reason: "not_configured" | "failed"; error?: string };

const recentSends = new Map<string, number[]>();
const PRUNE_ABOVE_KEYS = 1000;

function within(key: string, now: number): number[] {
  return (recentSends.get(key) ?? []).filter((t) => now - t < FEEDBACK_LIMIT_WINDOW_MS);
}

// Counts the send against every limit, or against none when any of them is used up
export function allowFeedback(limits: { key: string; max: number }[]): boolean {
  const now = Date.now();
  if (recentSends.size > PRUNE_ABOVE_KEYS) {
    for (const key of recentSends.keys()) {
      if (within(key, now).length === 0) recentSends.delete(key);
    }
  }
  const counted = limits.map(({ key, max }) => ({ key, max, sends: within(key, now) }));
  if (counted.some(({ max, sends }) => sends.length >= max)) return false;
  for (const { key, sends } of counted) recentSends.set(key, [...sends, now]);
  return true;
}

export function resetFeedbackLimits() {
  recentSends.clear();
}

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

export async function sendFeedbackThanks(to: string, message: string, userId: number) {
  if (isE2ETestMode()) return;
  try {
    await sendEmail({ to, ...buildFeedbackThanksEmail(message) });
  } catch (err) {
    recordSystemError("feedback", "thank-you email failed", { level: "warning", userId, err });
  }
}
