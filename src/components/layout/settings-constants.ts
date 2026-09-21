export const LABEL = "text-muted-foreground font-mono text-[10px]";
export const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

export const THEMES = [
  { id: "capy", label: "capy", bg: "#fdf6e3", fg: "#7c4b2a" },
  { id: "gruvbox", label: "gruvbox", bg: "#282828", fg: "#d79921" },
  { id: "terminal", label: "terminal", bg: "#000000", fg: "#00ff41" },
] as const;

export type UserTone = "chill" | "professional" | "motivational" | "custom";
export type AIProvider = "ollama" | "openai" | "anthropic";

export const TONE_OPTIONS: { value: UserTone; label: string }[] = [
  { value: "chill", label: "chill" },
  { value: "professional", label: "professional" },
  { value: "motivational", label: "motivational" },
  { value: "custom", label: "custom" },
];

export const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: "ollama", label: "ollama" },
  { value: "openai", label: "openai" },
  { value: "anthropic", label: "anthropic" },
];
