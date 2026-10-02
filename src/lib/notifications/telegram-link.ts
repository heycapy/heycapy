import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { TELEGRAM_LINK_TTL_MS } from "@/constants";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function createTelegramLinkCode(userId: number, now = new Date()): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  await db
    .update(userSettings)
    .set({
      telegramLinkCodeHash: hashCode(code),
      telegramLinkExpiresAt: new Date(now.getTime() + TELEGRAM_LINK_TTL_MS),
    })
    .where(eq(userSettings.userId, userId));
  return code;
}

export function redeemTelegramLinkCode(
  code: string,
  chatId: string,
  now = new Date()
): number | null {
  return db.transaction((tx) => {
    const owner = tx
      .update(userSettings)
      .set({
        telegramChatId: chatId,
        notificationsTelegram: true,
        telegramLinkCodeHash: null,
        telegramLinkExpiresAt: null,
      })
      .where(
        and(
          eq(userSettings.telegramLinkCodeHash, hashCode(code)),
          gt(userSettings.telegramLinkExpiresAt, now)
        )
      )
      .returning({ userId: userSettings.userId })
      .get();
    if (!owner) return null;

    tx.update(userSettings)
      .set({ telegramChatId: null, notificationsTelegram: false })
      .where(and(eq(userSettings.telegramChatId, chatId), ne(userSettings.userId, owner.userId)))
      .run();
    return owner.userId;
  });
}
