export type ReleaseNote = { title: string; text: string };
export type Release = { version: string; notes: ReleaseNote[] };

export const RELEASES: [Release, ...Release[]] = [
  {
    version: "0.7.0",
    notes: [
      {
        title: "your data is backed up",
        text: "every change you make is copied to a safe place away from the server within seconds, and heycapy keeps a full copy every night for a week. if the server ever breaks, your buckets, items and reminders come back as they were.",
      },
      {
        title: "self-hosting?",
        text: 'the off-site copy is off until you add a bucket. "off-site backups" in the README shows how.',
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
export const CHANGELOG_URL = "https://github.com/heycapy/heycapy/blob/main/CHANGELOG.md";
