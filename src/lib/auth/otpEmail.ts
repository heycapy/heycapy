import { APP_NAME, EMAIL_COLORS as C, USELESS_FACTS_API_URL } from "@/constants";
import { emailLayout } from "@/lib/email/layout";
import { OTP_TTL_MINUTES } from "./constants";
import { escapeHtml } from "@/lib/notifications/telegram-message";

async function fetchRandomFact(): Promise<string | null> {
  try {
    const res = await fetch(USELESS_FACTS_API_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return data.text ?? null;
  } catch {
    return null;
  }
}

export type OtpPurpose = "sign-in" | "delete-account";

const PURPOSE_COPY: Record<OtpPurpose, { label: string; ignore: string }> = {
  "sign-in": {
    label: "sign-in",
    ignore: "didn't request this? ignore it — your account is safe.",
  },
  "delete-account": {
    label: "account deletion",
    ignore:
      "didn't ask to delete your account? don't share this code, and use \"log out everywhere\".",
  },
};

export async function buildOtpEmail(
  code: string,
  purpose: OtpPurpose = "sign-in"
): Promise<{ subject: string; text: string; html: string }> {
  const copy = PURPOSE_COPY[purpose];
  const fact = purpose === "sign-in" ? await fetchRandomFact() : null;

  const subject = `[${APP_NAME}] your ${copy.label} code`;

  const text = [
    `your ${copy.label} code: ${code}`,
    ``,
    `expires in ${OTP_TTL_MINUTES} minutes.`,
    copy.ignore,
    ...(fact ? [``, `did you know? ${fact}`, `(please check yourself, please :| )`] : []),
  ].join("\n");

  const factHtml = fact
    ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${C.border};font-size:11px;color:${C.accent};">[ did you know ]</p>
              <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:${C.text};">${escapeHtml(fact)}</p>
              <p style="margin:6px 0 0;font-size:11px;font-style:italic;color:${C.muted};">please check yourself, please :|</p>`
    : "";

  const html = emailLayout({
    label: `${copy.label} code`,
    preheader: `your ${copy.label} code — expires in ${OTP_TTL_MINUTES} minutes`,
    body: `<p style="margin:0;font-size:13px;color:${C.muted};">your code — expires in ${OTP_TTL_MINUTES} minutes</p>
              <p style="margin:12px 0 0;padding:18px 0;background:${C.panel};text-align:center;font-size:36px;font-weight:700;letter-spacing:0.25em;color:${C.text};">${escapeHtml(code)}</p>
              <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${C.muted};">${escapeHtml(copy.ignore)}</p>
              ${factHtml}`,
  });

  return { subject, text, html };
}
