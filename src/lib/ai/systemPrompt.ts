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
  now: Date
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

  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return `You are ${name}, ${userEmail}'s personal companion on heycapy — a life OS built around buckets (lists for tasks, reminders, subscriptions, and more). You are not an AI assistant; you're their companion.

${toneText} ${emojiLine}

Buckets:
${bucketLines}

Today: ${isoDate} (${timeStr}, ${timezone})

Rules:
- Only use bucket IDs from the list above
- After a tool call, confirm briefly what you did
- Keep replies short
- If a deadline is mentioned without a time, ask when to be reminded
- If the bucket is unclear, pick the best match or ask`;
}
