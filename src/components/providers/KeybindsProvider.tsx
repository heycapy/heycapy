"use client";

import { createContext, use, type ReactNode } from "react";
import type { StoredKeybinds } from "@/lib/keybinds/schema";

const KeybindsContext = createContext<StoredKeybinds>({});

export function KeybindsProvider({
  keybinds,
  children,
}: {
  keybinds: StoredKeybinds;
  children: ReactNode;
}) {
  return <KeybindsContext value={keybinds}>{children}</KeybindsContext>;
}

export function useStoredKeybinds(): StoredKeybinds {
  return use(KeybindsContext);
}
