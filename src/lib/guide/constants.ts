export const STARTER_BUCKET_NAME = "reminders";
export const STARTER_TEMPLATE = "Reminders";

export const E2E_STARTER_EMAIL_PREFIX = "e2e-guide";

// what a new account's capy starts as, so changing either counts
export const CAPY_DEFAULT_NAME = "capy";
export const CAPY_DEFAULT_TONE = "chill";

export const GUIDE_TASKS = [
  {
    key: "add_item",
    title: "add a reminder",
    credits: 2,
    hint: "type what to remember and press add",
  },
  {
    key: "add_date",
    title: "give a reminder a date",
    credits: 2,
    hint: 'type a date in the title like "friday 9am", or pick one under the title',
  },
  {
    key: "complete_item",
    title: "tick a reminder done",
    credits: 2,
    hint: "tap the dot next to a reminder and pick completed",
  },
  {
    key: "reminder_time",
    title: "choose when a reminder pings you",
    credits: 3,
    hint: "give it a date, then pick how long before it you want a ping",
  },
  {
    key: "repeat_item",
    title: "make a reminder repeat",
    credits: 3,
    hint: "give it a date, then pick how often it repeats",
  },
  {
    key: "own_bucket",
    title: "make a bucket of your own",
    credits: 3,
    hint: "pick a template and give it a name",
  },
  {
    key: "share_bucket",
    title: "invite someone to a bucket",
    credits: 4,
    hint: "make an invite code and send it to them",
  },
  { key: "theme", title: "pick a theme", credits: 2, hint: "pick any theme you like" },
  {
    key: "username",
    title: "change your username",
    credits: 2,
    hint: "type a new username, or generate another",
  },
  { key: "avatar", title: "draw your avatar", credits: 3, hint: "draw or pick an avatar and save" },
  { key: "rename_capy", title: "give capy a new name", credits: 2, hint: "type any name and save" },
  {
    key: "capy_tone",
    title: "change capy's personality",
    credits: 2,
    hint: "pick a tone, or write your own",
  },
  {
    key: "ask_capy",
    title: "ask capy something",
    credits: 3,
    hint: 'try "remind me to call mom on sunday"',
  },
  {
    key: "quiet_hours",
    title: "set quiet hours",
    credits: 3,
    hint: "set quiet hours, nothing is sent in between",
  },
  {
    key: "push",
    title: "turn on push on a device",
    credits: 3,
    hint: "turn on push, your browser asks to allow it",
  },
  {
    key: "ntfy",
    title: "get reminders on ntfy",
    credits: 2,
    hint: "fill in an ntfy topic and save",
  },
  {
    key: "telegram",
    title: "connect telegram",
    credits: 4,
    hint: "connect telegram and send the code to the bot",
    needs: "TELEGRAM_BOT_TOKEN",
  },
  {
    key: "smtp",
    title: "send a test email from your own email account",
    credits: 5,
    hint: 'under email, fill in your account and press "send test email"',
  },
] as const;

export type GuideTaskKey = (typeof GUIDE_TASKS)[number]["key"];
