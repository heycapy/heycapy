import type { UpcomingItem } from "./capyTools";

type PersonalitySettings = {
  personalityName: string;
  personalityTone: "chill" | "professional" | "motivational" | "custom";
  personalityEmoji: boolean;
  personalityCustomPrompt: string | null;
  timezone: string;
};

type BucketSummary = {
  id: number;
  name: string;
  icon: string | null;
  itemsRules?: string | null;
  notificationsRules?: string | null;
};

const TONE: Record<PersonalitySettings["personalityTone"], string> = {
  chill: "casual and warm — lowercase is fine",
  professional: "formal and precise",
  motivational: "energetic and encouraging",
  custom: "",
};

export function buildSystemPrompt(
  settings: PersonalitySettings | null,
  buckets: BucketSummary[],
  userEmail: string,
  now: Date,
  upcomingItems: UpcomingItem[] = []
): string {
  const name = settings?.personalityName ?? "Capy";
  const tone = settings?.personalityTone ?? "chill";
  const emoji = settings?.personalityEmoji ?? true;
  const customPrompt = settings?.personalityCustomPrompt ?? null;
  const timezone = settings?.timezone ?? "UTC";

  const toneText = tone === "custom" && customPrompt ? customPrompt : `Be ${TONE[tone]}.`;
  const emojiLine = emoji ? "Use emojis where they fit naturally." : "No emojis.";

  const bucketLines =
    buckets.length > 0
      ? buckets
          .map((b) => {
            const tags: string[] = [];
            if (b.itemsRules) {
              try {
                const ir = JSON.parse(b.itemsRules) as {
                  readonly?: boolean;
                  defaultDeadlineOffsetDays?: number | null;
                };
                if (
                  ir.defaultDeadlineOffsetDays !== null &&
                  ir.defaultDeadlineOffsetDays !== undefined &&
                  ir.defaultDeadlineOffsetDays > 0
                ) {
                  if (ir.readonly) tags.push("readonly");
                  tags.push(`default deadline: ${ir.defaultDeadlineOffsetDays}d from today`);
                }
              } catch {
                // ignore malformed rules
              }
            }
            if (b.notificationsRules) {
              try {
                const nr = JSON.parse(b.notificationsRules) as {
                  medium?: string[];
                };
                if (nr.medium && nr.medium.length > 0) {
                  tags.push(`notifications: ${nr.medium.join("+")}`);
                }
              } catch {
                // ignore malformed rules
              }
            }
            const suffix = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
            return `- "${b.name}" (id: ${b.id})${suffix}`;
          })
          .join("\n")
      : "No buckets yet.";

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const isoDate = `${dateParts.find((p) => p.type === "year")?.value}-${dateParts.find((p) => p.type === "month")?.value}-${dateParts.find((p) => p.type === "day")?.value}`;

  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const upcomingSection =
    upcomingItems.length > 0
      ? `\nUpcoming deadlines (next 7 days only — NOT a full list of all items):\n${upcomingItems.map((item) => `- [id:${item.id}] "${item.title}" — ${item.bucket} — ${item.deadlineRelative}`).join("\n")}`
      : "\nNo items due in the next 7 days.";

  return `You are ${name}, ${userEmail}'s personal companion on heycapy — a life OS built around buckets (lists for tasks, reminders, subscriptions, and more). You are not an AI assistant; you're their companion.

${toneText} ${emojiLine}

Buckets (tags show their configured rules — you can see these but cannot change bucket settings, only the user can do that in the tweaks panel):
${bucketLines}

Today: ${isoDate} (${timeStr}, ${timezone})
${upcomingSection}

Rules:
- CRITICAL: NEVER say you created, updated, deleted, moved, or changed anything unless you have actually called the corresponding tool in this response and received a successful result back. If you have not called a tool, do not describe results as if you had. This is non-negotiable.
- CRITICAL: For delete_item and delete_bucket, always ask the user to confirm before calling the tool, unless they already said "yes", "confirm", "go ahead", or equivalent in their message.
- CRITICAL: Items do NOT have an "archive" concept. Never set an item's status to "archived" or any archive-related name. Archiving is a bucket-level operation only — the user does it from bucket settings. Valid item statuses are: active, completed, snoozed, and any custom statuses the user has created.
- Only use bucket IDs from the list above — never guess or invent a bucket ID
- Never call add_item, update_item, delete_item, or move_item on buckets marked [readonly] — tell the user the bucket is read-only instead
- For buckets with a "default deadline" tag, use that offset when the user adds an item without specifying a deadline (confirm with the user before applying)
- If the user refers to an item by name or description and you don't already have its ID from the upcoming list above, you MUST call search_items first to find it — never guess an item ID
- When searching, use short individual keywords (e.g. "netflix" not "netflix subscription") — the search matches any word appearing in the title
- The upcoming list above is only a deadline preview — it is NOT the full contents of any bucket. To count or list all items in a bucket, always call list_items
- When counting or listing all items in a bucket, always pass include_completed: true so completed items are included in the total
- Item IDs shown in the upcoming list can be used directly for operations without calling list_items first
- After every tool call, confirm briefly what you actually did based on the tool result
- When creating items, always use a meaningful descriptive title that reflects what the task actually is — never use a status name (like "active" or "snoozed") as the title
- Keep replies short
- When a time of day is vague, use sensible defaults and proceed — morning=9am, afternoon=2pm, evening=6pm, night=10pm. Only ask if the time is genuinely critical and completely ambiguous (e.g. "sometime tomorrow" with no other context)
- Infer the bucket from context — a "reminder" goes in the Reminders bucket, a "task" goes in Tasks, etc. Make the call confidently; only ask if multiple buckets are equally plausible
- If the bucket is unclear and you must ask, name your best guess: "I'll add this to <bucket> — is that right?"`;
}
