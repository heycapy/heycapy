import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { createBucketFromTemplate } from "@/lib/db/buckets";
import { isE2ETestMode } from "@/lib/e2e";
import { E2E_STARTER_EMAIL_PREFIX, STARTER_BUCKET_NAME, STARTER_TEMPLATE } from "./constants";

// Every other E2E spec expects a new account to start with no buckets
export function getsStarterBucket(email: string): boolean {
  return !isE2ETestMode() || email.startsWith(E2E_STARTER_EMAIL_PREFIX);
}

// Made with the account's own timestamp, so "a bucket of your own" doesn't count it
export async function createStarterBucket(userId: number, signedUpAt: Date): Promise<number> {
  const template = await db.query.templates.findFirst({
    where: and(eq(templates.name, STARTER_TEMPLATE), eq(templates.isBuiltin, true)),
  });
  if (!template) throw new Error(`Built-in template "${STARTER_TEMPLATE}" is missing`);
  const bucketId = await createBucketFromTemplate(
    userId,
    template,
    STARTER_BUCKET_NAME,
    signedUpAt
  );
  if (bucketId === null) throw new Error(`Built-in template "${STARTER_TEMPLATE}" is corrupted`);
  return bucketId;
}
