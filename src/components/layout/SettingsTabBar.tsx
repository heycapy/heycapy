import type { SettingsTab } from "./SettingsSheet";
import { Tab } from "@/components/ui/Tab";
import { cn } from "@/lib/utils";

type SettingsTabBarProps = {
  tab: SettingsTab;
  hasCredits: boolean;
  adminUser: boolean;
  onTab: (tab: SettingsTab) => void;
};

export function SettingsTabBar({ tab, hasCredits, adminUser, onTab }: SettingsTabBarProps) {
  const tabs: SettingsTab[] = [
    "appearance",
    "keybindings",
    "ai",
    ...(hasCredits ? (["credits"] as const) : []),
    "notifications",
    "personality",
    "account",
    ...(adminUser ? (["system"] as const) : []),
  ];
  return (
    <div className="border-border scrollbar-hide flex gap-0.5 overflow-x-auto border-b px-1.5 py-1">
      {tabs.map((t) => (
        <Tab
          key={t}
          active={tab === t}
          onClick={() => onTab(t)}
          className={cn("px-1.5 py-1.5", t === "keybindings" && "no-fine-pointer:hidden")}
        >
          {t}
        </Tab>
      ))}
    </div>
  );
}
