export const STARTER_BUCKET_NAME = "reminders";
export const STARTER_TEMPLATE = "Reminders";

export const E2E_STARTER_EMAIL_PREFIX = "e2e-guide";

// what a new account's capy starts as, so changing either counts
export const CAPY_DEFAULT_TONE = "chill";

export const GUIDE_TASKS = [
  {
    key: "add_item",
    title: "add a reminder",
    credits: 2,
    hint: "type what to remember in the add box and press enter",
  },
  {
    key: "add_date",
    title: "give a reminder a date",
    credits: 2,
    hint: 'type a date after the title, like "call mum friday 9am"',
  },
  {
    key: "complete_item",
    title: "tick a reminder done",
    credits: 2,
    hint: "tap the box next to a reminder to tick it done",
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
  {
    key: "theme",
    title: "pick a theme and look",
    credits: 2,
    hint: "pick any theme or look you like",
  },
  {
    key: "username",
    title: "change your username",
    credits: 2,
    hint: "type a new username, or generate another",
  },
  { key: "avatar", title: "draw your avatar", credits: 3, hint: "draw or pick an avatar and save" },
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
  {
    key: "open_tweaks",
    title: "open tweaks",
    credits: 0,
    hint: "tap your avatar, then tweaks",
  },
  {
    key: "keyboard_shortcuts",
    title: "see the keyboard shortcuts",
    credits: 0,
    hint: "press ctrl+; (cmd+; on a mac), then ?",
  },
] as const;

export const OPENED_GUIDE_TASKS = ["open_tweaks", "keyboard_shortcuts"] as const;

export type GuideTaskKey = (typeof GUIDE_TASKS)[number]["key"];
