"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="capy"
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
    </NextThemesProvider>
  );
}
