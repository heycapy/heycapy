export const PREFIX_TIMEOUT_MS = 1500;
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
