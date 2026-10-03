import { and, isNull } from "drizzle-orm";
import { buckets } from "@/lib/db/schema";

// Deleting or archiving a bucket leaves its items untouched so they come back with it;
// until then they stay out of lists and send no reminders
export const inLiveBucket = and(isNull(buckets.deletedAt), isNull(buckets.archivedAt));
