"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import {
  TOAST_BOTTOM_OFFSET,
  TOAST_GAP,
  TOAST_PHONE_BOTTOM_OFFSET,
  TOAST_PHONE_TOP_ROOM,
  TOAST_SIDE_OFFSET,
} from "@/constants";
import { NOTIFY_LIMIT } from "@/components/ui/constants";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="gruvbox-dark-2"
      themes={[
        "capy",
        "light",
        "dark",
        "gruvbox",
        "gruvbox-light",
        "gruvbox-dark-2",
        "terminal",
        "everforest-dark",
        "tokyonight",
        "rosepine",
        "rosepine-dark",
        "nord",
        "dracula",
        "solarized-dark",
        "catppuccin-mocha",
        "one-dark",
        "nightowl",
        "midnight",
      ]}
      disableTransitionOnChange
    >
      {children}
      <Toaster
        position="bottom-center"
        offset={{
          bottom: `calc(${TOAST_BOTTOM_OFFSET}px + var(--item-panel-cover, 0px))`,
          left: TOAST_SIDE_OFFSET,
          right: TOAST_SIDE_OFFSET,
        }}
        mobileOffset={{
          bottom: `min(calc(${TOAST_PHONE_BOTTOM_OFFSET}px + var(--item-panel-cover, 0px) + env(safe-area-inset-bottom)), calc(100dvh - ${TOAST_PHONE_TOP_ROOM}px))`,
          left: TOAST_SIDE_OFFSET,
          right: TOAST_SIDE_OFFSET,
        }}
        swipeDirections={["left", "right", "bottom"]}
        visibleToasts={NOTIFY_LIMIT}
        gap={TOAST_GAP}
      />
    </NextThemesProvider>
  );
}
