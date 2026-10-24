import type { GuideTaskKey } from "@/lib/guide/constants";
import type { SettingsTab } from "@/components/layout/SettingsSheet";

export type HintTarget =
  | { kind: "add-item" }
  | { kind: "list" }
  | { kind: "new-bucket" }
  | { kind: "bucket-members" }
  | { kind: "chat" }
  | { kind: "settings"; tab: SettingsTab };

export const HINT_TARGETS: Record<GuideTaskKey, HintTarget> = {
  add_item: { kind: "add-item" },
  add_date: { kind: "add-item" },
  complete_item: { kind: "list" },
  reminder_time: { kind: "add-item" },
  repeat_item: { kind: "add-item" },
  theme: { kind: "settings", tab: "appearance" },
  quiet_hours: { kind: "settings", tab: "notifications" },
  own_bucket: { kind: "new-bucket" },
  share_bucket: { kind: "bucket-members" },
  username: { kind: "settings", tab: "account" },
  avatar: { kind: "settings", tab: "account" },
  rename_capy: { kind: "settings", tab: "personality" },
  capy_tone: { kind: "settings", tab: "personality" },
  ask_capy: { kind: "chat" },
  push: { kind: "settings", tab: "notifications" },
  ntfy: { kind: "settings", tab: "notifications" },
  telegram: { kind: "settings", tab: "notifications" },
  smtp: { kind: "settings", tab: "notifications" },
};

// Browsers only allow these on https (or localhost), so on a plain http server they can't be done
export const HTTPS_ONLY_TASKS: GuideTaskKey[] = ["push"];
