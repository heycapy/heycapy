export type Prefix = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

export const PREFIX_EDITING = "prefix";
export const PREFIX_CHECK = "prefix-check";

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
export type KeybindEditing = KeybindActionId | typeof PREFIX_EDITING | typeof PREFIX_CHECK | null;
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
// Safari), checked 2026-11-12. A warning, not a rule: checking the prefix shows what really arrives
export const KEYBIND_CLASHES: KeybindClash[] = [
  ...clashes("pc", "ctrl", "Chrome", [
    ["n", "open a new window"],
    ["t", "open a new tab"],
    ["w", "close the tab"],
    ["h", "open history"],
    ["j", "open downloads"],
    ["k", "search from the address bar"],
    ["l", "jump to the address bar"],
    ["o", "open a file"],
    ["p", "print "],
    ["s", "save the page"],
    ["u", "show the page source"],
    ["d", "bookmark the page"],
    ["f", "find on the page"],
    ["g", "jump to the next find match"],
    ["e", "search from the address bar"],
  ]),
  ...clashes("pc", "alt", "Chrome", [
    ["d", "jump to the address bar"],
    ["f", "open the menu"],
    ["e", "open the menu"],
  ]),
  ...clashes("pc", "ctrl", "Firefox", [
    ["k", "focus the search bar"],
    ["e", "focus the search bar"],
  ]),
  ...clashes("mac", "meta", "Chrome and Safari", [
    ["n", "open a new window"],
    ["t", "open a new tab"],
    ["w", "close the tab"],
    ["y", "open history"],
    ["f", "find on the page"],
    ["g", "jump to the next find match"],
    ["e", "search for the selected text"],
    ["l", "jump to the address bar"],
    ["o", "open a file"],
    ["p", "print "],
    ["s", "save the page"],
    ["d", "bookmark the page"],
    [",", "open settings"],
    ["h", "hide the browser"],
    ["q", "quit the browser"],
    ["m", "minimize the window"],
    ["[", "go back"],
    ["]", "go forward"],
    ["`", "switch window"],
    ...BUCKET_NUMBERS.map((n): ClashRow => [String(n), "switch to a tab"]),
  ]),
  ...clashes("mac", "meta", "macOS", [
    [";", "find misspelled words in text"],
    [" ", "open Spotlight"],
  ]),
  ...clashes("mac", "ctrl", "macOS", [[" ", "switch the input source"]]),
];

const ctrl = (key: string): Prefix => ({ key, ctrl: true, meta: false, alt: false, shift: false });
const alt = (key: string): Prefix => ({ key, ctrl: false, meta: false, alt: true, shift: false });
const cmd = (key: string): Prefix => ({ key, ctrl: false, meta: true, alt: false, shift: false });

// Option+key types another character on a Mac (Option+; is "…"), so a prefix on it never matches
export const SUGGESTED_PREFIXES: Record<KeybindPlatform, Prefix[]> = {
  pc: [ctrl(";"), ctrl("'"), ctrl("."), alt(";"), alt("'")],
  mac: [ctrl(";"), ctrl("'"), ctrl("."), cmd("'")],
};
