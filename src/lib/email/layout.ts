import { APP_TAGLINE, EMAIL_COLORS as C } from "@/constants";
import { escapeHtml } from "@/lib/notifications/telegram-message";

export type EmailLink = { label: string; url: string };

export const MONO = `'SF Mono', Menlo, Consolas, 'Courier New', monospace`;

export function emailLinks(links: EmailLink[]): string {
  if (links.length === 0) return "";
  const items = links
    .map(
      (l) =>
        `<a href="${escapeHtml(l.url)}" style="display:inline-block;margin:0 20px 10px 0;font-family:${MONO};font-size:14px;font-weight:700;color:${C.accent};text-decoration:none;white-space:nowrap;">[ ${escapeHtml(l.label)} ]</a>`
    )
    .join("");
  return `<p style="margin:24px 0 0;line-height:1.4;">${items}</p>`;
}

export function emailLayout(opts: { label: string; preheader: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>heycapy</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding:0 0 12px;font-family:${MONO};font-size:13px;color:${C.accent};">
              <b>heycapy</b><span style="color:${C.muted};"> · ${escapeHtml(opts.label)}</span>
            </td>
          </tr>
          <tr>
            <td style="background:${C.card};border:1px solid ${C.border};padding:28px 28px 26px;font-family:${MONO};color:${C.text};">
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 0 0;font-family:${MONO};font-size:11px;color:${C.muted};">${escapeHtml(APP_TAGLINE)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
