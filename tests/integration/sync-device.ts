import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, itemReminders, items } from "@/lib/db/schema";
import { pull, type PullRecord, type PullTombstone } from "@/lib/sync/pull";

export function fetchPage(userId: number, cursor: number, limit = 1000) {
  const result = pull(db, userId, cursor, limit);
  if (result.reset) throw new Error("unexpected reset");
  return result;
}

// What a client keeps, changed the way the protocol says a client must apply a page: every delete
// first, then every row, and a reminder lives and dies with its item
export class Device {
  rows = new Map<string, PullRecord>();
  cursor = 0;
  pages = 0;

  constructor(private readonly userId: number) {}

  sync(limit = 1000) {
    for (;;) {
      const page = fetchPage(this.userId, this.cursor, limit);
      this.pages++;
      for (const t of page.tombstones) this.remove(t);
      for (const r of page.records) this.rows.set(`${r.entity}:${r.id}`, r);
      this.cursor = page.cursor;
      if (!page.more) return;
    }
  }

  private remove(t: PullTombstone) {
    const dropBucket = (bucketId: number) => {
      for (const [key, row] of this.rows) {
        const inside =
          (row.entity === "bucket" && row.id === bucketId) ||
          (row.entity === "bucket_member" && row.data.bucketId === bucketId) ||
          (row.entity === "item" && row.data.bucketId === bucketId);
        if (!inside) continue;
        this.rows.delete(key);
        if (row.entity === "item") this.rows.delete(`item_reminder:${row.id}`);
      }
    };
    if (t.entity === "bucket") dropBucket(Number(t.id));
    else if (t.entity === "bucket_member") {
      if (t.userId === this.userId && t.bucketId !== null) dropBucket(t.bucketId);
      else this.rows.delete(`bucket_member:${t.id}`);
    } else if (t.entity === "item") {
      const local = this.rows.get(`item:${t.id}`);
      if (local?.entity === "item" && local.data.bucketId === t.bucketId) {
        this.rows.delete(`item:${t.id}`);
        this.rows.delete(`item_reminder:${t.id}`);
      }
    } else this.rows.delete(`item_reminder:${t.id}`);
  }

  keys() {
    return [...this.rows.values()].map((r) => `${r.entity}:${r.id}@${r.rev}`).sort();
  }
}

// What the server says this person can see, read straight from the tables
export function visible(userId: number): string[] {
  const mine = db
    .select({ id: bucketMembers.bucketId })
    .from(bucketMembers)
    .where(eq(bucketMembers.userId, userId))
    .all()
    .map((r) => r.id);
  const keys: string[] = [];
  for (const b of db.select().from(buckets).where(inArray(buckets.id, mine)).all()) {
    keys.push(`bucket:${b.id}@${b.rev}`);
  }
  for (const m of db
    .select()
    .from(bucketMembers)
    .where(inArray(bucketMembers.bucketId, mine))
    .all()) {
    keys.push(`bucket_member:${m.id}@${m.rev}`);
  }
  for (const i of db.select().from(items).where(inArray(items.bucketId, mine)).all()) {
    keys.push(`item:${i.id}@${i.rev}`);
    for (const r of db
      .select()
      .from(itemReminders)
      .where(and(eq(itemReminders.itemId, i.id), eq(itemReminders.userId, userId)))
      .all()) {
      keys.push(`item_reminder:${r.itemId}@${r.rev}`);
    }
  }
  return keys.sort();
}
