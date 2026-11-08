import { eq } from "drizzle-orm";
import { CONTROL_SIZE, LOOK, TICK_SOUND } from "@/constants";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

export async function appearanceFor(userId: number) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { look: true, controlSize: true, tickSound: true },
  });
  return {
    look: settings?.look ?? LOOK.original,
    controlSize: settings?.controlSize ?? CONTROL_SIZE.medium,
    tickSound: settings?.tickSound ?? TICK_SOUND.drop,
  };
}
