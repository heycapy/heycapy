export type ReleaseNote = { title: string; text: string };
export type Release = { version: string; notes: ReleaseNote[] };

export const RELEASES: [Release, ...Release[]] = [
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
