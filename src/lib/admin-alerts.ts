import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemErrors, userSettings, users } from "@/lib/db/schema";
import { adminEmails } from "@/lib/auth/admin";
import { withTimeout } from "@/lib/async";
import { errorMessage } from "@/lib/errors";
import { isE2ETestMode } from "@/lib/e2e";
import { sendEmail } from "@/lib/notifications/email";
import { sendTelegram } from "@/lib/notifications/telegram";
import {
  ADMIN_ALERT_TIMEOUT_MS,
  ADMIN_DIGEST_MAX_ERRORS,
  APP_NAME,
  STACK_LINES_IN_ALERT,
  TELEGRAM_MESSAGE_MAX,
} from "@/constants";

type SystemError = typeof systemErrors.$inferSelect;

async function recipients() {
  const emails = adminEmails();
  if (emails.length === 0) return [];
  return db
    .select({
      email: users.email,
      emailTo: userSettings.notificationEmailTo,
      telegramChatId: userSettings.telegramChatId,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(sql`lower(${users.email})`, emails));
}

// Both channels, each on its own: whichever is broken, the other still gets through.
// Failures only go to stderr; recording them would alert about alerting.
async function deliver(subject: string, text: string): Promise<boolean> {
  if (isE2ETestMode()) return false;
  const admins = await recipients();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const sends = admins.flatMap((admin) => [
    sendEmail({ to: admin.emailTo ?? admin.email, subject, text }),
    ...(botToken && admin.telegramChatId
      ? [
          sendTelegram(
            botToken,
            admin.telegramChatId,
            `${subject}\n\n${text}`.slice(0, TELEGRAM_MESSAGE_MAX)
          ),
        ]
      : []),
  ]);
  const results = await Promise.allSettled(
    sends.map((send) => withTimeout(send, ADMIN_ALERT_TIMEOUT_MS, "admin alert"))
  );
  for (const r of results) {
    if (r.status === "rejected") {
      process.stderr.write(`[admin-alerts] send failed: ${errorMessage(r.reason)}\n`);
    }
  }
  return results.some((r) => r.status === "fulfilled");
}

export function formatSystemError(e: SystemError): string {
  const details = (() => {
    try {
      return JSON.parse(e.details ?? "{}") as {
        stack?: string;
        context?: Record<string, unknown>;
        runtime?: Record<string, unknown>;
      };
    } catch {
      return {};
    }
  })();
  const lines = [
    `[${e.level}] ${e.source} · ${e.createdAt.toISOString()}${e.userId !== null ? ` · user ${e.userId}` : ""}`,
    e.message,
  ];
  if (details.context && Object.keys(details.context).length > 0) {
    lines.push(`context: ${JSON.stringify(details.context)}`);
  }
  if (details.runtime) lines.push(`runtime: ${JSON.stringify(details.runtime)}`);
  if (details.stack) {
    lines.push(details.stack.split("\n").slice(0, STACK_LINES_IN_ALERT).join("\n"));
  }
  return lines.join("\n");
}

async function markAlerted(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.update(systemErrors).set({ alertedAt: new Date() }).where(inArray(systemErrors.id, ids));
}

export async function alertAdminsNow(error: SystemError): Promise<void> {
  try {
    const sent = await deliver(
      `[${APP_NAME}] critical: ${error.source} — ${error.message.slice(0, 80)}`,
      `${formatSystemError(error)}\n\nmore in tweaks → system`
    );
    if (sent) await markAlerted([error.id]);
  } catch (err) {
    process.stderr.write(`[admin-alerts] ${errorMessage(err)}\n`);
  }
}

export async function sendErrorDigest(): Promise<void> {
  const pending = await db
    .select()
    .from(systemErrors)
    .where(isNull(systemErrors.alertedAt))
    .orderBy(asc(systemErrors.id))
    .limit(ADMIN_DIGEST_MAX_ERRORS);
  if (pending.length === 0) return;

  const bySource = new Map<string, number>();
  for (const e of pending) bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
  const summary = [...bySource].map(([source, n]) => `${n}× ${source}`).join(", ");

  const sent = await deliver(
    `[${APP_NAME}] ${pending.length} new server ${pending.length === 1 ? "error" : "errors"} (${summary})`,
    `${pending.map(formatSystemError).join("\n\n---\n\n")}\n\nmore in tweaks → system`
  );
  if (sent) await markAlerted(pending.map((e) => e.id));
}
