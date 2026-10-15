import { APP_NAME, EMAIL_COLORS as C } from "@/constants";
import { emailLayout } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/notifications/telegram-message";

const THANKS =
  "capy read it twice, nodded slowly, and carried it straight to the human who builds heycapy. a real person reads every one of these.";
const NEXT =
  "if it needs an answer, you'll hear back. if it was a bug, capy is already glaring at it.";

export function buildFeedbackThanksEmail(message: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `[${APP_NAME}] capy got your note`;

  const text = [`thanks for the feedback!`, ``, THANKS, NEXT, ``, `what you sent:`, message].join(
    "\n"
  );

  const html = emailLayout({
    label: "feedback",
    preheader: "thanks for the feedback, capy got it",
    body: `<p style="margin:0;font-size:15px;font-weight:700;color:${C.text};">thanks for the feedback!</p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${C.text};">${escapeHtml(THANKS)}</p>
              <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:${C.muted};">${escapeHtml(NEXT)}</p>
              <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${C.border};font-size:11px;color:${C.accent};">[ what you sent ]</p>
              <p style="margin:6px 0 0;padding:12px;background:${C.panel};font-size:13px;line-height:1.6;color:${C.text};white-space:pre-wrap;">${escapeHtml(message)}</p>`,
  });

  return { subject, text, html };
}
