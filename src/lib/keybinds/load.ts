import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { parseStoredKeybinds } from "./schema";
import type { StoredKeybinds } from "./schema";

export async function keybindsFor(userId: number): Promise<StoredKeybinds> {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { keybinds: true },
  });
  return parseStoredKeybinds(settings?.keybinds);
}
