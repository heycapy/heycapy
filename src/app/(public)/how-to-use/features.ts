export type DetailItem =
  | { type: "text"; text: string }
  | { type: "step"; text: string }
  | { type: "code"; text: string }
  | { type: "tip"; text: string };

export type Feature = {
  title: string;
  desc: string;
  where: string;
  detail: DetailItem[];
};

export const FEATURES: Feature[] = [
  {
    title: "buckets",
    desc: "organize anything into lists. pick a template or start blank.",
    where: "home → [add bucket]",
    detail: [
      {
        type: "text",
        text: "buckets are top-level containers. each one is its own list with independent settings.",
      },
      {
        type: "step",
        text: "pick a template (blank, ci/cd monitor, etc.) or start fresh and name it anything.",
      },
      {
        type: "step",
        text: "drag the tab bar to reorder. archive buckets you don't need right now.",
      },
      {
        type: "step",
        text: "each bucket has its own sort order, readonly mode, and show/hide completed toggle.",
      },
      {
        type: "tip",
        text: "deleted buckets go to trash — restore them anytime from the header menu.",
      },
    ],
  },
  {
    title: "items",
    desc: "add tasks with titles, deadlines, and optional recurring schedules.",
    where: "inside any bucket",
    detail: [
      {
        type: "text",
        text: "items have a title, optional deadline, status, and optional recurring config.",
      },
      { type: "step", text: "click any item to edit it. enter to save, escape to cancel." },
      { type: "step", text: "items on hold get no reminders until you change their status." },
      { type: "step", text: "custom schema fields show up as extra inputs in the item editor." },
      {
        type: "tip",
        text: "items added via webhook show a source badge so you know where they came from.",
      },
    ],
  },
  {
    title: "notifications",
    desc: "email, push, telegram or ntfy per bucket. offsets, quiet hours, repeat.",
    where: "bucket settings → notifications",
    detail: [
      { type: "text", text: "each bucket picks its own channels independently." },
      {
        type: "step",
        text: "remind-before offset: get notified X mins/hours/days before the deadline.",
      },
      {
        type: "step",
        text: "remind at: the time of day for items without a time; reminders never fire earlier than it.",
      },
      {
        type: "step",
        text: "quiet hours: no notifications fire within this window (e.g. 22:00 to 08:00).",
      },
      {
        type: "step",
        text: "deadline repeat: once, or re-send every day until item is completed.",
      },
      { type: "step", text: "notify on arrival: fires every time a new item lands via webhook." },
      {
        type: "tip",
        text: "notify when overdue: fires after deadline passes without completion. set a repeat interval (15min, 1h, etc.).",
      },
    ],
  },
  {
    title: "webhooks",
    desc: 'every bucket has a url + key. post {"title": "..."} from anywhere.',
    where: "bucket settings → advanced",
    detail: [
      { type: "text", text: "every bucket gets a unique url and key. rotate the key anytime." },
      { type: "step", text: 'minimum payload: {"title": "your item"}' },
      {
        type: "step",
        text: 'optional: "deadline" (ISO datetime), "status" ("active" / "completed" / "on hold")',
      },
      {
        type: "code",
        text: 'curl -X POST https://app.heycapy.xyz/api/webhook/ID \\\n  -H "Authorization: Bearer KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"title": "deploy failed"}\'',
      },
      {
        type: "tip",
        text: "if the bucket has a custom schema, include those fields too — they get validated on arrival.",
      },
    ],
  },
  {
    title: "ai chat",
    desc: "capy lives bottom-right. add items, parse deadlines, ask things.",
    where: "bottom-right corner",
    detail: [
      {
        type: "text",
        text: "capy can add items, parse natural language deadlines, and answer questions about your buckets.",
      },
      { type: "step", text: "ctrl+\\ to toggle the chat open/closed." },
      { type: "step", text: "configure your provider in settings → tweaks → ai provider." },
      { type: "step", text: "supported: ollama (local), openai, anthropic, groq, gemini." },
      {
        type: "tip",
        text: "chat history is saved — access it via the history icon in the chat header.",
      },
    ],
  },
  {
    title: "voice input",
    desc: "tap the mic in capy chat. transcribed via openai whisper.",
    where: "capy chat → mic icon",
    detail: [
      { type: "text", text: "tap the mic to start recording. tap again or hit stop when done." },
      {
        type: "step",
        text: "the recording is transcribed via openai whisper and dropped into the chat.",
      },
      { type: "step", text: "requires an openai api key with whisper access in settings." },
      {
        type: "tip",
        text: "keyboard shortcut: ctrl+shift+m to toggle recording without touching the mouse.",
      },
    ],
  },
  {
    title: "bucket schema",
    desc: "define custom fields per bucket. text, number, select, date.",
    where: "bucket settings → advanced → schema",
    detail: [
      {
        type: "text",
        text: "schema attaches structured data to every item beyond just title and deadline.",
      },
      { type: "step", text: "field types: text, number, select (with options), date, boolean." },
      {
        type: "step",
        text: "fields appear in the item editor and can be marked required or optional.",
      },
      {
        type: "tip",
        text: "webhook payloads are validated against the schema — missing required fields get rejected with a clear error.",
      },
    ],
  },
  {
    title: "smtp",
    desc: "bring your own email server. host, port, user, password.",
    where: "settings → tweaks → smtp",
    detail: [
      { type: "text", text: "swap the default email provider for any smtp server you control." },
      { type: "step", text: "fields: host, port, username, password, from address." },
      {
        type: "step",
        text: "works with gmail app passwords, protonmail bridge, mailgun, postmark smtp, or any relay.",
      },
      {
        type: "tip",
        text: "test the connection from settings after saving — sends a test email to confirm it works.",
      },
    ],
  },
  {
    title: "telegram bot",
    desc: "connect telegram for notifications and adding items from chat.",
    where: "settings → tweaks → telegram",
    detail: [
      { type: "text", text: "heycapy has its own telegram bot. no need to create one." },
      { type: "step", text: "go to settings → tweaks → telegram and follow the connect steps." },
      { type: "step", text: "message @heycapybot on telegram to link your account." },
      {
        type: "step",
        text: "once connected, buckets with telegram enabled will push reminders directly to you.",
      },
      {
        type: "tip",
        text: "per-bucket config (shortcuts, time slots, deadline buttons) is in bucket settings → notifications → configure telegram.",
      },
    ],
  },
  {
    title: "recurring items",
    desc: "set daily, weekly, monthly, or yearly repeat on any item.",
    where: "item editor → recurring",
    detail: [
      {
        type: "text",
        text: "recurring items auto-create the next occurrence after the current one is notified.",
      },
      { type: "step", text: "open any item, toggle recurring on, set frequency and interval." },
      { type: "step", text: "optionally set an end date — recurrence stops after that." },
      {
        type: "step",
        text: "the original item stays as-is. the next one is always created as active.",
      },
      {
        type: "tip",
        text: "great for bills, check-ins, maintenance tasks, or anything on a regular schedule.",
      },
    ],
  },
];
