import { cn } from "@/lib/utils";
import type { SettingsTab } from "./SettingsSheet";

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
        <button
          key={t}
          onClick={() => onTab(t)}
          className={cn(
            "shrink-0 px-2 py-1.5 font-mono text-xs whitespace-nowrap transition-colors",
            tab === t ? "bg-foreground text-background" : "text-primary hover:text-foreground"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
