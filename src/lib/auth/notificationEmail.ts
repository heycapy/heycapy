import { APP_NAME } from "@/constants";

export function buildNotificationEmail(
  title: string,
  message: string
): { text: string; html: string } {
  const displayTitle = title.replace(/^\[[^\]]+\]\s*(Overdue:\s*)?/, "");

  const text = [
    `[ ${APP_NAME} ] — reminder`,
    ``,
    `  ${displayTitle}`,
    ``,
    message,
    ``,
    `your capy — sent while relaxing`,
  ].join("\n");

  const mono = `'Courier New', Courier, monospace`;
  const bg = `#fdf6e3`;
  const fg = `#2c1f0e`;
  const border = `#2c1f0e`;
  const muted = `#7a6a55`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${displayTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:${mono};">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">reminder from ${APP_NAME} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${bg};border:2px solid ${border};">

          <tr>
            <td style="padding:20px 32px 16px;border-bottom:1px solid ${border};">
              <p style="margin:0;font-family:${mono};font-size:18px;font-weight:700;color:${fg};letter-spacing:-0.01em;">[ ${APP_NAME} ]</p>
              <p style="margin:4px 0 0;font-family:${mono};font-size:11px;color:${muted};letter-spacing:0.05em;">reminder</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 24px;">
              <p style="margin:0 0 16px;font-family:${mono};font-size:18px;font-weight:700;color:${fg};">${displayTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              <p style="margin:0;font-family:${mono};font-size:14px;color:${fg};line-height:1.6;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </td>
          </tr>

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

  return { text, html };
}
