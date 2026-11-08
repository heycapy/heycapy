// showGuide adds a button that opens the getting started tasks
export type ReleaseNote = { title: string; text: string; showGuide?: true };
export type Release = { version: string; notes: ReleaseNote[] };

export const RELEASES: [Release, ...Release[]] = [
  {
    version: "0.11.1",
    notes: [
      {
        title: "calmer reduce motion",
        text: "the switch works the moment you tap it, and buckets swap without blinking. buckets you've opened show their items straight away.",
      },
    ],
  },
  {
    version: "0.11.0",
    notes: [
      {
        title: "ticking feels right",
        text: "the box pops the moment you tap it, with a little sound. pick chime, sparkle, success, harp or off in tweaks › appearance.",
      },
      {
        title: "bigger text, less motion",
        text: "tweaks › appearance has a text size and a reduce motion switch that turns off every animation.",
      },
      {
        title: "quieter toasts",
        text: "one small line above the add bar, never more than three, and done items stay in new buckets instead of vanishing.",
      },
    ],
  },
  {
    version: "0.10.0",
    notes: [
      {
        title: "a whole new heycapy",
        text: "our biggest update yet: every screen was redrawn. your buckets, items and reminders are all where you left them, but take a minute to look around.",
      },
      {
        title: "buckets are tabs",
        text: "search, today and your buckets sit in tabs along the top. hold a tab and drag it to put your buckets in your own order.",
      },
      {
        title: "tick it off",
        text: "every item has a tick box now. long press or right click an item for everything else.",
      },
      {
        title: "add from one bar",
        text: "type at the bottom of any list and press the arrow. open the full form for dates, repeats and reminders, and each bucket keeps its own draft.",
      },
      {
        title: "pick a look",
        text: 'tweaks › appearance › look: "original" keeps the pixel style, "modern" is clean and rounded. your pick follows you to every device.',
      },
      {
        title: "on hold is gone",
        text: 'items that were on hold are active again. to put something off, give it a later date or tap "remind again" on its reminder.',
      },
    ],
  },
  {
    version: "0.9.0",
    notes: [
      {
        title: "when, at a glance",
        text: 'every item shows when it\'s due on the left: "3d late", "today" with the time, "tomorrow" or "in 4d". the colours follow your theme.',
      },
      {
        title: "who does what, in shared buckets",
        text: "show everyone's items, yours or one person's. done items say who ticked them, and the item menu assigns with one tap on a face.",
      },
      {
        title: "switch buckets with a swipe",
        text: "on phones, swipe the bucket button at the bottom to go to the next or previous place.",
      },
      {
        title: "capy sets up your fields",
        text: "ask capy for a bucket with a price or a link on every item, or to change the fields of one you own.",
      },
    ],
  },
  {
    version: "0.8.2",
    notes: [
      {
        title: "who it's for, on today",
        text: "today and search now show who in a shared bucket an item is for, like the bucket itself does.",
      },
    ],
  },
  {
    version: "0.8.1",
    notes: [
      {
        title: "capy gets it right more often",
        text: "name a few things in one message and capy adds each one. it fills your bucket's own fields, remembers what it already did in a chat, and asks before deleting an item.",
      },
      {
        title: "done from the item menu",
        text: "right click or long press an item to mark it done or reopen it.",
      },
      {
        title: "who it's for, from today",
        text: "editing an item from today or search now lets you change who in a shared bucket it's for.",
      },
    ],
  },
  {
    version: "0.8.0",
    notes: [
      {
        title: "getting started, with credits",
        text: '"guide" at the top, or getting started in the ··· menu, lists things to try in heycapy. each one ticks itself once you\'ve done it and "hint" shows you where it is. on heycapy.xyz each one also gives capy credits.',
        showGuide: true,
      },
    ],
  },
  {
    version: "0.7.1",
    notes: [
      {
        title: "the page stays put",
        text: "with a window open, like this one or tweaks, scrolling no longer moves the page behind it. on iphone too.",
      },
      {
        title: "escape closes windows",
        text: "press escape to close any window. with one open on top of another, the top one closes first, and you're back where you were.",
      },
      {
        title: "what's new keeps it short",
        text: 'it shows the last three updates now. "all changes" opens the full list.',
      },
    ],
  },
  {
    version: "0.7.0",
    notes: [
      {
        title: "your data is backed up",
        text: "every change you make is copied to a safe place away from the server within seconds, and heycapy keeps a full copy every night for a week. if the server ever breaks, your buckets, items and reminders come back as they were.",
      },
      {
        title: "self-hosting?",
        text: 'the copy away from the server is off until you set it up. "off-site backups" in the README shows how. the nightly copies work as before.',
      },
    ],
  },
  {
    version: "0.6.1",
    notes: [
      {
        title: "easier to read in five themes",
        text: "links, active tabs and buttons were too faint in gruvbox light, rosé pine dawn, rosé pine, solarized and midnight. they stand out now.",
      },
      {
        title: "the members tab keeps up",
        text: "with bucket settings → members open, a member's new name or avatar shows up without opening the tab again.",
      },
    ],
  },
  {
    version: "0.6.0",
    notes: [
      {
        title: "change your username",
        text: 'in tweaks → account, type a new one or press "generate another". you can change it twice in 30 days, and your old name stays yours for 30 days.',
      },
      {
        title: "new names and avatars show up straight away",
        text: "when someone in a shared bucket changes their name or avatar, everyone sees it without reloading.",
      },
    ],
  },
  {
    version: "0.5.0",
    notes: [
      {
        title: "set notifications once for every bucket",
        text: 'pick your channels, reminders and overdue alerts in tweaks → notifications → bucket defaults. new buckets use them, and any bucket can go back to them with "use tweaks".',
      },
      {
        title: "the right message after buying credits",
        text: "coming back from checkout no longer says the payment didn't go through when it did.",
      },
    ],
  },
  {
    version: "0.4.0",
    notes: [
      {
        title: "reminder emails come from your own account",
        text: "heycapy only sends sign-in codes itself now. to keep getting reminders by email, set up your own email in tweaks → notifications → email. with gmail it takes about two minutes.",
      },
      {
        title: "pixel icons",
        text: "every icon in the app is pixel art now, to match capy.",
      },
      {
        title: "clearer notification settings",
        text: "bucket settings → notifications is split into sections: where, when to remind, if it's overdue and reminder buttons.",
      },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0].version;

// older ones are in the full changelog
export const RELEASES_SHOWN = 3;

export const CHANGELOG_URL = "https://github.com/heycapy/heycapy/blob/main/CHANGELOG.md";
