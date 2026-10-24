export const STARTER_BUCKET_NAME = "reminders";
export const STARTER_TEMPLATE = "Reminders";

export const E2E_STARTER_EMAIL_PREFIX = "e2e-guide";

export const GUIDE_TASKS = [
  {
    key: "add_item",
    title: "add a reminder",
    credits: 3,
    hint: "type what to remember and press add",
  },
  {
    key: "add_date",
    title: "give a reminder a date",
    credits: 3,
    hint: 'type a date in the title like "friday 9am", or pick one under the title',
  },
  {
    key: "complete_item",
    title: "tick a reminder done",
    credits: 3,
    hint: "tap the dot next to a reminder and pick completed",
  },
  { key: "theme", title: "pick a theme", credits: 3, hint: "pick any theme you like" },
  {
    key: "quiet_hours",
    title: "set quiet hours",
    credits: 4,
    hint: "set quiet hours, nothing is sent in between",
  },
  {
    key: "own_bucket",
    title: "make a bucket of your own",
    credits: 4,
    hint: "pick a template and give it a name",
  },
  {
    key: "username",
    title: "change your username",
    credits: 5,
    hint: "type a new username, or generate another",
  },
  { key: "avatar", title: "draw your avatar", credits: 5, hint: "draw or pick an avatar and save" },
  {
    key: "ask_capy",
    title: "ask capy something",
    credits: 5,
    hint: 'try "remind me to call mom on sunday"',
  },
  {
    key: "push",
    title: "turn on push on a device",
    credits: 5,
    hint: "turn on push, your browser asks to allow it",
  },
  {
    key: "telegram",
    title: "connect telegram",
    credits: 5,
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
