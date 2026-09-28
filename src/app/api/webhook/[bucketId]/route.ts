import { bucketChannels } from "@/lib/rules";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { decryptValue } from "@/lib/crypto";
import { BucketSchema, buildPropertyValidator } from "@/types/rules";
import { enqueueNotification, processPending } from "@/lib/notifications/queue";
import {
  WEBHOOK_RATE_LIMIT_MAX,
  WEBHOOK_RATE_LIMIT_WINDOW_MS,
} from "@/lib/notifications/constants";
import { errorMessage } from "@/lib/errors";
import { ITEM_STATUS, ITEM_TITLE_MAX_LENGTH } from "@/constants";
import { channelDecisions } from "@/lib/notifications/channels";
import { initialReminderState } from "@/lib/items/reminders";
import { dataEvents } from "@/lib/events";
import { refreshItemReminders, reminderContext } from "@/lib/reminders/refresh";
import { parseDeadlineString } from "@/lib/time";

const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rateLimitMap.get(key) ?? []).filter(
    (t) => now - t < WEBHOOK_RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= WEBHOOK_RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bucketId: string }> }
) {
  const { bucketId: bucketIdStr } = await params;
  const bucketId = parseInt(bucketIdStr, 10);
  if (isNaN(bucketId)) {
    return Response.json({ error: "Invalid bucket ID" }, { status: 400 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const providedKey = authHeader.slice(7);

  const bucket = await db.query.buckets.findFirst({
    where: (b, { and: qa, eq: qe, isNull: qn }) =>
      qa(qe(b.id, bucketId), qn(b.deletedAt), qn(b.archivedAt)),
  });
  if (!bucket) {
    return Response.json({ error: "Bucket not found" }, { status: 404 });
  }

  if (!bucket.webhookKey) {
    return Response.json({ error: "Webhook not enabled for this bucket" }, { status: 401 });
  }

  let storedKey: string;
  try {
    storedKey = decryptValue(bucket.webhookKey);
  } catch {
    return Response.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  if (providedKey !== storedKey) {
    return Response.json({ error: "Invalid webhook key" }, { status: 401 });
  }

  if (!checkRateLimit(storedKey)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.title !== "string" || !raw.title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  const title = raw.title.trim();
  if (title.length > ITEM_TITLE_MAX_LENGTH) {
    return Response.json(
      { error: `title must be ${ITEM_TITLE_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  let properties: Record<string, unknown> | null = null;
  let parsedSchema: ReturnType<typeof BucketSchema.safeParse> | null = null;

  if (bucket.fieldSchema) {
    parsedSchema = BucketSchema.safeParse(
      typeof bucket.fieldSchema === "string" ? JSON.parse(bucket.fieldSchema) : bucket.fieldSchema
    );
    if (parsedSchema.success && parsedSchema.data.fields.length > 0) {
      const validator = buildPropertyValidator(parsedSchema.data.fields);
      const result = validator.safeParse(raw);
      if (!result.success) {
        return Response.json(
          { error: "Field validation failed", issues: result.error.issues },
          { status: 400 }
        );
      }
      properties = result.data as Record<string, unknown>;
    }
  }

  // Optional status — must be one of the three built-in statuses
  const VALID_STATUSES = [ITEM_STATUS.active, ITEM_STATUS.completed, ITEM_STATUS.onHold] as const;
  let status: string | undefined;
  if (raw.status !== undefined) {
    if (typeof raw.status !== "string") {
      return Response.json({ error: "status must be a string" }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(raw.status as (typeof VALID_STATUSES)[number])) {
      return Response.json(
        { error: `invalid status "${raw.status}" — valid values: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    status = raw.status;
  }

  // Optional deadline — an ISO datetime, or YYYY-MM-DD for an all-day item
  const ctx = await reminderContext(bucketId);
  let deadline: Date | undefined;
  if (raw.deadline !== undefined) {
    if (typeof raw.deadline !== "string") {
      return Response.json({ error: "deadline must be an ISO datetime string" }, { status: 400 });
    }
    const d = parseDeadlineString(raw.deadline, ctx.timezone);
    if (isNaN(d.getTime())) {
      return Response.json({ error: "deadline is not a valid datetime" }, { status: 400 });
    }
    deadline = d;
  }

  const [item] = await db
    .insert(items)
    .values({
      bucketId,
      userId: bucket.userId,
      title,
      properties: properties ? JSON.stringify(properties) : null,
      source: "webhook",
      ...(status !== undefined && { status }),
      ...(deadline !== undefined && {
        deadline,
        ...initialReminderState(deadline, ctx.timezone),
      }),
    })
    .returning();
  await refreshItemReminders([item.id]);

  const hasArrivalTrigger = parsedSchema?.success && parsedSchema.data.notifyOnArrival === true;

  if (hasArrivalTrigger) {
    const userRow = await db.query.userSettings.findFirst({
      where: (s, { eq: qe }) => qe(s.userId, bucket.userId),
    });

    if (userRow) {
      await enqueueNotification({
        userId: bucket.userId,
        itemId: item.id,
        kind: "arrival",
        title: `New item in ${bucket.name}`,
        message: `"${title}" was added via webhook.`,
        channels: channelDecisions(bucketChannels(bucket.notificationsRules), userRow),
      });

      void processPending().catch((err) => {
        process.stderr.write(`[webhook] processPending error: ${errorMessage(err)}\n`);
      });
    }
  }

  dataEvents.emit("refresh", bucket.userId);

  return Response.json({ id: item.id, title: item.title }, { status: 201 });
}
