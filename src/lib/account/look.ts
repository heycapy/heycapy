import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { DEFAULT_APPEARANCE } from "./constants";

export async function appearanceFor(userId: number) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { look: true, controlSize: true, tickSound: true, reduceMotion: true, textSize: true },
  });
  return settings ?? DEFAULT_APPEARANCE;
}
