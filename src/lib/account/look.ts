import { eq } from "drizzle-orm";
import { LOOK } from "@/constants";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

export async function lookFor(userId: number) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { look: true },
  });
  return settings?.look ?? LOOK.original;
}
