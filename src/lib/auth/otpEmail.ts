import { APP_NAME, USELESS_FACTS_API_URL } from "@/constants";
import { OTP_TTL_MINUTES } from "./constants";

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

export async function buildOtpEmail(
  code: string
): Promise<{ subject: string; text: string; html: string }> {
  const fact = await fetchRandomFact();

  const subject = `[${APP_NAME}] your sign-in code`;

  const factText = fact ? `\n\n[did you know] ${fact}` : "";

  const text = [
    `[ ${APP_NAME} ] — sign-in code`,
    ``,
    `  ${code}`,
    ``,
    `expires in ${OTP_TTL_MINUTES} minutes.`,
    `if you didn't request this, ignore it.`,
    factText,
    ``,
    `your capy — sent while relaxing`,
  ].join("\n");

  const mono = `'Courier New', Courier, monospace`;
  const bg = `#fdf6e3`;
  const fg = `#2c1f0e`;
  const border = `#2c1f0e`;
  const muted = `#7a6a55`;

  const factHtml = fact
    ? `
          <tr>
            <td style="padding:0 32px 0;">
              <div style="border-top:1px solid ${border};padding-top:16px;padding-bottom:16px;">
                <span style="font-family:${mono};font-size:11px;color:${muted};letter-spacing:0.05em;">[did you know]</span>
                <p style="margin:6px 0 0;font-family:${mono};font-size:13px;color:${fg};line-height:1.6;">${fact.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              </div>
            </td>
          </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:${mono};">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">sign-in code for ${APP_NAME} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${bg};border:2px solid ${border};">

          <tr>
            <td style="padding:20px 32px 16px;border-bottom:1px solid ${border};">
              <p style="margin:0;font-family:${mono};font-size:18px;font-weight:700;color:${fg};letter-spacing:-0.01em;">[ ${APP_NAME} ]</p>
              <p style="margin:4px 0 0;font-family:${mono};font-size:11px;color:${muted};letter-spacing:0.05em;">sign-in request</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 12px;font-family:${mono};font-size:12px;color:${muted};letter-spacing:0.05em;">your one-time code — expires in ${OTP_TTL_MINUTES} minutes:</p>
              <div style="border:2px solid ${border};padding:20px;text-align:center;">
                <span style="font-family:${mono};font-size:40px;font-weight:900;letter-spacing:0.25em;color:${fg};">${code}</span>
              </div>
              <p style="margin:12px 0 0;font-family:${mono};font-size:11px;color:${muted};">didn&rsquo;t request this? ignore it — your account is safe.</p>
            </td>
          </tr>

          ${factHtml}

          <tr>
            <td style="padding:16px 32px 20px;border-top:1px solid ${border};">
              <p style="margin:0;font-family:${mono};font-size:11px;color:${muted};">your capy &mdash; sent while relaxing</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
