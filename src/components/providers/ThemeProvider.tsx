"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { MOBILE_MEDIA_QUERY, TOAST_BOTTOM_OFFSET, TOAST_SIDE_OFFSET } from "@/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const phone = useMediaQuery(MOBILE_MEDIA_QUERY);
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
        position={phone ? "top-center" : "bottom-left"}
        offset={{ bottom: TOAST_BOTTOM_OFFSET, left: TOAST_SIDE_OFFSET }}
        mobileOffset={{
          top: `calc(${TOAST_SIDE_OFFSET}px + env(safe-area-inset-top))`,
          left: TOAST_SIDE_OFFSET,
          right: TOAST_SIDE_OFFSET,
        }}
        swipeDirections={phone ? ["left", "right", "top"] : ["left", "bottom"]}
        visibleToasts={3}
        expand
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "!bg-background !text-foreground !border-border !rounded-panel !border-frame font-ui !text-xs !shadow-raised-sm !py-2 !pr-1 !pl-3 !gap-2",
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
