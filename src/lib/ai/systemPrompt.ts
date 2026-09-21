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
      ? buckets.map((b) => `- "${b.name}" (id: ${b.id})`).join("\n")
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

Buckets:
${bucketLines}

Today: ${isoDate} (${timeStr}, ${timezone})
${upcomingSection}

Rules:
- Only use bucket IDs from the list above — never guess or invent a bucket ID
- If the user refers to an item by name or description and you don't already have its ID from the upcoming list above, you MUST call search_items first to find it — never guess an item ID
- When searching, use short individual keywords (e.g. "netflix" not "netflix subscription") — the search matches any word appearing in the title
- The upcoming list above is only a deadline preview — it is NOT the full contents of any bucket. To count or list all items in a bucket, always call list_items
- When counting or listing all items in a bucket, always pass include_completed: true so completed items are included in the total
- Item IDs shown in the upcoming list can be used directly for operations without calling list_items first
- After a tool call, confirm briefly what you did
- Keep replies short
- If a deadline is mentioned without a time, ask what time before calling any tool
- If the bucket is unclear, pick the best match or ask`;
}
