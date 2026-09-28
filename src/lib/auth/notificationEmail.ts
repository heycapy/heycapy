import { EMAIL_COLORS as C } from "@/constants";
import { emailLayout, emailLinks, type EmailLink } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/notifications/telegram-message";

export type { EmailLink };

export function buildNotificationEmail(
  title: string,
  message: string,
  links: EmailLink[] = []
): { text: string; html: string } {
  const displayTitle = title.replace(/^\[[^\]]+\]\s*(Overdue:\s*)?/, "");

  const text = [
    displayTitle,
    ``,
    message,
    ...(links.length > 0 ? [``, ...links.map((l) => `${l.label}: ${l.url}`)] : []),
  ].join("\n");

  const html = emailLayout({
    label: "reminder",
    preheader: message,
    body: `<p style="margin:0;font-size:20px;font-weight:700;line-height:1.35;color:${C.text};">${escapeHtml(displayTitle)}</p>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${C.muted};">${escapeHtml(message)}</p>
              ${emailLinks(links)}`,
  });

  return { text, html };
}
