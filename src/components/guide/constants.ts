import type { GuideTaskKey } from "@/lib/guide/constants";
import type { SettingsTab } from "@/components/layout/SettingsSheet";

export type HintTarget =
  | { kind: "add-item" }
  | { kind: "list" }
  | { kind: "new-bucket" }
  | { kind: "chat" }
  | { kind: "settings"; tab: SettingsTab };

export const HINT_TARGETS: Record<GuideTaskKey, HintTarget> = {
  add_item: { kind: "add-item" },
  add_date: { kind: "add-item" },
  complete_item: { kind: "list" },
  theme: { kind: "settings", tab: "appearance" },
  quiet_hours: { kind: "settings", tab: "notifications" },
  own_bucket: { kind: "new-bucket" },
  username: { kind: "settings", tab: "account" },
  avatar: { kind: "settings", tab: "account" },
  ask_capy: { kind: "chat" },
  push: { kind: "settings", tab: "notifications" },
  telegram: { kind: "settings", tab: "notifications" },
  smtp: { kind: "settings", tab: "notifications" },
};
