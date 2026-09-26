"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

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
        position="bottom-left"
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "!relative !bg-background !text-foreground !border-border !border-2 !rounded-none font-mono !text-xs !shadow-none",
            title: "!text-foreground font-mono !text-xs",
            description: "!text-muted-foreground font-mono !text-[10px]",
            error: "!border-destructive",
            closeButton:
              "!bg-transparent !border-0 !shadow-none !text-muted-foreground hover:!text-foreground font-mono !text-[10px]",
          },
        }}
      />
    </NextThemesProvider>
  );
}
