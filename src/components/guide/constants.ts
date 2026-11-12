import type { GuideTaskKey } from "@/lib/guide/constants";
import type { SettingsTab } from "@/components/layout/SettingsSheet";

export type HintTarget =
  // the add box, or the full form for what the box can't set
  | { kind: "add-item"; form: boolean }
  | { kind: "list" }
  | { kind: "new-bucket" }
  | { kind: "bucket-members" }
  | { kind: "chat" }
  | { kind: "settings"; tab: SettingsTab }
  | { kind: "none" };

export const HINT_TARGETS: Record<GuideTaskKey, HintTarget> = {
  add_item: { kind: "add-item", form: false },
  add_date: { kind: "add-item", form: false },
  complete_item: { kind: "list" },
  reminder_time: { kind: "add-item", form: true },
  repeat_item: { kind: "add-item", form: true },
  theme: { kind: "settings", tab: "appearance" },
  quiet_hours: { kind: "settings", tab: "notifications" },
  own_bucket: { kind: "new-bucket" },
  share_bucket: { kind: "bucket-members" },
  username: { kind: "settings", tab: "account" },
  avatar: { kind: "settings", tab: "account" },
  capy_tone: { kind: "settings", tab: "personality" },
  ask_capy: { kind: "chat" },
  push: { kind: "settings", tab: "notifications" },
  ntfy: { kind: "settings", tab: "notifications" },
  telegram: { kind: "settings", tab: "notifications" },
  smtp: { kind: "settings", tab: "notifications" },
  open_tweaks: { kind: "none" },
  keyboard_shortcuts: { kind: "none" },
};

// Browsers only allow these on https (or localhost), so on a plain http server they can't be done
export const HTTPS_ONLY_TASKS: GuideTaskKey[] = ["push"];

// Shortcuts need a keyboard, so a phone or tablet with only a touchscreen doesn't get them
export const KEYBOARD_ONLY_TASKS: GuideTaskKey[] = ["keyboard_shortcuts"];
