import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authRateLimits, otps, users } from "@/lib/db/schema";

// everything else (settings, buckets, items, history, chats, templates) goes with the user deletion
export function deleteAccount(userId: number, email: string): void {
  db.transaction((tx) => {
    tx.delete(users).where(eq(users.id, userId)).run();
    tx.delete(otps).where(eq(otps.email, email)).run();
    tx.delete(authRateLimits).where(eq(authRateLimits.email, email)).run();
  });
}
