import { eq, lte, lt, max, sql } from "drizzle-orm";
import { TOMBSTONE_RETENTION_DAYS } from "@/constants";
import { db } from "@/lib/db";
import { syncState, syncTombstones } from "@/lib/db/schema";

// Drops what is past its retention and records the highest revision dropped. A device whose cursor is
// below that has missed deletes and has to download everything again. Everything up to the recorded
// revision goes, not only the old rows, so "nothing at or below min_rev is left" holds even if the
// clock moved
export function pruneTombstones(now = new Date()): number {
  const cutoff = new Date(now.getTime() - TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return db.transaction((tx) => {
    const [found] = tx
      .select({ rev: max(syncTombstones.rev) })
      .from(syncTombstones)
      .where(lt(syncTombstones.createdAt, cutoff))
      .all();
    const upTo = found?.rev;
    if (upTo === null || upTo === undefined) return 0;
    const pruned = tx.delete(syncTombstones).where(lte(syncTombstones.rev, upTo)).run();
    tx.update(syncState)
      .set({ minRev: sql`max(${syncState.minRev}, ${upTo})` })
      .where(eq(syncState.id, 1))
      .run();
    return pruned.changes;
  });
}
