export const PREFIX_TIMEOUT_MS = 1500;
export const PREFIX_TEST_MS = 5000;
export const ESCAPE_KEY = "Escape";

export const KEYBIND_ACTION = {
  quickAdd: "quick-add",
  addWithDetails: "add-with-details",
  previousBucket: "previous-bucket",
  nextBucket: "next-bucket",
  today: "today",
  search: "search",
  capy: "capy",
  mic: "mic",
  bucketSettings: "bucket-settings",
  tweaks: "tweaks",
  cheatSheet: "cheat-sheet",
} as const;

export type KeybindActionId = (typeof KEYBIND_ACTION)[keyof typeof KEYBIND_ACTION] | BucketActionId;
export type BucketActionId = `bucket-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export type KeybindAction = {
  id: KeybindActionId;
  key: string;
  label: string;
  rebindable: boolean;
};

export const BUCKET_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const BUCKET_ACTIONS: KeybindAction[] = BUCKET_NUMBERS.map((n) => ({
  id: `bucket-${n}`,
  key: String(n),
  label: `bucket ${n}`,
  rebindable: false,
}));

export const KEYBIND_ACTIONS: KeybindAction[] = [
  { id: KEYBIND_ACTION.quickAdd, key: "a", label: "quick add", rebindable: true },
  { id: KEYBIND_ACTION.addWithDetails, key: "d", label: "add with details", rebindable: true },
  { id: KEYBIND_ACTION.previousBucket, key: "h", label: "previous bucket", rebindable: true },
  { id: KEYBIND_ACTION.nextBucket, key: "l", label: "next bucket", rebindable: true },
  ...BUCKET_ACTIONS,
  { id: KEYBIND_ACTION.today, key: "t", label: "today", rebindable: true },
  { id: KEYBIND_ACTION.search, key: "/", label: "search", rebindable: true },
  { id: KEYBIND_ACTION.capy, key: "c", label: "toggle capy", rebindable: true },
  { id: KEYBIND_ACTION.mic, key: "m", label: "mic (chat open)", rebindable: true },
  { id: KEYBIND_ACTION.bucketSettings, key: "s", label: "bucket settings", rebindable: true },
  { id: KEYBIND_ACTION.tweaks, key: ",", label: "tweaks", rebindable: true },
  { id: KEYBIND_ACTION.cheatSheet, key: "?", label: "cheat sheet", rebindable: true },
];

export const DEFAULT_PREFIX_KEY = ";";

export type KeybindPlatform = "pc" | "mac";

export type KeybindClash = {
  platform: KeybindPlatform;
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  source: string;
  action: string;
};

type ClashRow = [key: string, action: string];

function clashes(
  platform: KeybindPlatform,
  modifier: "ctrl" | "meta" | "alt",
  source: string,
  rows: ClashRow[]
): KeybindClash[] {
  return rows.map(([key, action]) => ({
    platform,
    key,
    ctrl: modifier === "ctrl",
    meta: modifier === "meta",
    alt: modifier === "alt",
    source,
    action,
  }));
}

// From the vendors' own shortcut pages (Chrome help, Firefox support, Apple support: macOS and
// Safari), checked 2026-11-12. A warning, not a rule: "test your prefix" shows what really arrives
export const KEYBIND_CLASHES: KeybindClash[] = [
  ...clashes("pc", "ctrl", "Chrome", [
    ["n", "opens a new window"],
    ["t", "opens a new tab"],
    ["w", "closes the tab"],
    ["h", "opens history"],
    ["j", "opens downloads"],
    ["k", "searches from the address bar"],
    ["l", "jumps to the address bar"],
    ["o", "opens a file"],
    ["p", "prints"],
    ["s", "saves the page"],
    ["u", "shows the page source"],
    ["d", "bookmarks the page"],
    ["f", "finds on the page"],
    ["g", "jumps to the next find match"],
    ["e", "searches from the address bar"],
  ]),
  ...clashes("pc", "alt", "Chrome", [
    ["d", "jumps to the address bar"],
    ["f", "opens the menu"],
    ["e", "opens the menu"],
  ]),
  ...clashes("pc", "ctrl", "Firefox", [
    ["k", "focuses the search bar"],
    ["e", "focuses the search bar"],
  ]),
  ...clashes("mac", "meta", "Chrome and Safari", [
    ["n", "opens a new window"],
    ["t", "opens a new tab"],
    ["w", "closes the tab"],
    ["y", "opens history"],
    ["f", "finds on the page"],
    ["g", "jumps to the next find match"],
    ["e", "searches for the selected text"],
    ["l", "jumps to the address bar"],
    ["o", "opens a file"],
    ["p", "prints"],
    ["s", "saves the page"],
    ["d", "bookmarks the page"],
    [",", "opens settings"],
    ["h", "hides the browser"],
    ["q", "quits the browser"],
    ["m", "minimizes the window"],
    ["[", "goes back"],
    ["]", "goes forward"],
    ["`", "switches window"],
    ...BUCKET_NUMBERS.map((n): ClashRow => [String(n), "switches to a tab"]),
  ]),
  ...clashes("mac", "meta", "macOS", [
    [";", "finds misspelled words in text"],
    [" ", "opens Spotlight"],
  ]),
  ...clashes("mac", "ctrl", "macOS", [[" ", "switches the input source"]]),
];
