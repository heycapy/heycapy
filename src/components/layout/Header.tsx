"use client";

import { useMemo, useState } from "react";

interface HeaderProps {
  onCommandOpen: () => void;
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

export function Header({ onCommandOpen }: HeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const date = useMemo(() => getDate(), []);
  const [isMac] = useState(
    () => typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
  );

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <div>
        <h1 className="font-pixel text-base leading-snug">{greeting}</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
      </div>

      <button
        onClick={onCommandOpen}
        className="group flex items-center gap-1"
        aria-label="Open command palette"
      >
        <kbd
          suppressHydrationWarning
          className="border-border bg-muted text-muted-foreground group-hover:text-foreground rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors"
        >
          {isMac ? "⌘" : "Ctrl"}
        </kbd>
        <kbd className="border-border bg-muted text-muted-foreground group-hover:text-foreground rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors">
          K
        </kbd>
      </button>
    </header>
  );
}
