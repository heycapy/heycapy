"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { TOAST_BOTTOM_OFFSET, TOAST_SIDE_OFFSET } from "@/constants";

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
        offset={{ bottom: TOAST_BOTTOM_OFFSET }}
        mobileOffset={{
          bottom: `calc(${TOAST_BOTTOM_OFFSET}px + env(safe-area-inset-bottom))`,
          left: TOAST_SIDE_OFFSET,
          right: TOAST_SIDE_OFFSET,
        }}
        swipeDirections={["left", "right", "bottom"]}
        visibleToasts={3}
        expand
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "!bg-background !text-foreground !border-border !border-2 !rounded-none font-ui !text-xs !shadow-[2px_2px_0_var(--border)] !py-2 !pr-1 !pl-3 !gap-2",
            title: "!text-foreground font-ui !text-xs",
            description: "!text-muted-foreground font-ui !text-xs",
            error: "!border-destructive",
            closeButton:
              "!bg-transparent !border-0 !shadow-none !text-muted-foreground hover:!text-foreground font-ui !text-xs",
          },
        }}
      />
    </NextThemesProvider>
  );
}
