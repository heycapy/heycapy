import { APP_EMAIL_FROM } from "@/constants";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type UserEmailConfig = {
  emailProvider?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpSecure?: boolean | null;
  smtpFrom?: string | null;
};

async function sendViaResend(payload: EmailPayload, apiKey: string): Promise<void> {
  const { Resend } = await import("resend");
  const from = process.env.EMAIL_FROM ?? APP_EMAIL_FROM;
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    ...(payload.html ? { html: payload.html } : {}),
  });
  if (result.error) throw new Error(`Resend error: ${result.error.message}`);
}

async function sendViaSmtp(
  payload: EmailPayload,
  host: string,
  opts?: {
    port?: number | null;
    user?: string | null;
    pass?: string | null;
    secure?: boolean | null;
    from?: string | null;
  }
): Promise<void> {
  const nodemailer = await import("nodemailer");
  const port = opts?.port ?? parseInt(process.env.SMTP_PORT ?? "587");
  const secure = opts?.secure ?? (process.env.SMTP_SECURE === "true" || port === 465);
  const user = opts?.user ?? process.env.SMTP_USER;
  const pass = opts?.pass ?? process.env.SMTP_PASS;
  const from =
    opts?.from ??
    opts?.user ??
    process.env.SMTP_FROM ??
    process.env.SMTP_USER ??
    process.env.EMAIL_FROM ??
    APP_EMAIL_FROM;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    ...(payload.html ? { html: payload.html } : {}),
  });
}

export async function sendEmail(
  payload: EmailPayload,
  userConfig?: UserEmailConfig
): Promise<void> {
  if (userConfig?.emailProvider === "smtp" && userConfig.smtpHost) {
    await sendViaSmtp(payload, userConfig.smtpHost, {
      port: userConfig.smtpPort,
      user: userConfig.smtpUser,
      pass: userConfig.smtpPass,
      secure: userConfig.smtpSecure,
      from: userConfig.smtpFrom,
    });
    return;
  }
  const smtpHost = process.env.SMTP_HOST;
  const resendKey = process.env.RESEND_API_KEY;
  if (smtpHost) {
    await sendViaSmtp(payload, smtpHost);
    return;
  }
  if (resendKey) {
    await sendViaResend(payload, resendKey);
    return;
  }
}
