import type { SettingsTab } from "./SettingsSheet";
import { Tab } from "@/components/ui/Tab";

type SettingsTabBarProps = {
  tab: SettingsTab;
  hasCredits: boolean;
  adminUser: boolean;
  onTab: (tab: SettingsTab) => void;
};

export function SettingsTabBar({ tab, hasCredits, adminUser, onTab }: SettingsTabBarProps) {
  const tabs: SettingsTab[] = [
    "appearance",
    "ai",
    ...(hasCredits ? (["credits"] as const) : []),
    "notifications",
    "personality",
    "account",
    ...(adminUser ? (["system"] as const) : []),
  ];
  return (
    <div className="border-border flex flex-wrap gap-0.5 border-b px-2 py-1">
      {tabs.map((t) => (
        <Tab key={t} active={tab === t} onClick={() => onTab(t)} className="py-1.5">
          {t}
        </Tab>
      ))}
    </div>
  );
}
