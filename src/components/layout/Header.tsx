"use client";

import { useMemo } from "react";
import { Settings } from "lucide-react";

interface HeaderProps {
  onSettingsOpen: () => void;
}

const GREETINGS = {
  morning: ["Rise and shine ☀️", "Early bird 🌅", "Morning fuel ☕", "New day, new grind 🌤️"],
  afternoon: ["Afternoon check-in ⚡", "How's the day? 🛠️", "Power hour ☀️", "Keep going 💪"],
  evening: [
    "Winding down? 🌇",
    "Evening check-in 🌆",
    "Almost done for the day 🌙",
    "Golden hour 🍂",
  ],
  night: [
    "Don't you want to sleep? 🌙",
    "Still up? 🦦",
    "Burning the midnight oil 🕯️",
    "The night is yours 🌌",
  ],
};

function getGreeting() {
  const h = new Date().getHours();
  const day = new Date().getDate();
  let variants: string[];
  if (h >= 5 && h < 12) variants = GREETINGS.morning;
  else if (h >= 12 && h < 17) variants = GREETINGS.afternoon;
  else if (h >= 17 && h < 22) variants = GREETINGS.evening;
  else variants = GREETINGS.night;
  return variants[day % variants.length];
}

function getDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function Header({ onSettingsOpen }: HeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const date = useMemo(() => getDate(), []);

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <div>
        <h1 className="font-pixel text-base leading-snug">{greeting}</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSettingsOpen}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
