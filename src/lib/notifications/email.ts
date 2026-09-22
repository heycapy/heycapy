import { Resend } from "resend";
import { APP_EMAIL_FROM } from "@/constants";

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? APP_EMAIL_FROM;

  await resend.emails.send({ from, to, subject, text });
}
