// showGuide adds a button that opens the getting started tasks
export type ReleaseNote = { title: string; text: string; showGuide?: true };
export type Release = { version: string; notes: ReleaseNote[] };

export const RELEASES: [Release, ...Release[]] = [
  {
    version: "0.8.0",
    notes: [
      {
        title: "getting started, with credits",
        text: '"guide" at the top lists a few things to try in heycapy. each one ticks itself once you\'ve done it, gives capy credits, and "hint" shows you where it is.',
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
