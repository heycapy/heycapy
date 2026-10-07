import { GEMINI_DEFAULT_MODEL, type TranscriptionProvider } from "@/constants";

export const LABEL = "text-muted-foreground font-mono text-xs";
export const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

export const SECTION =
  "text-muted-foreground font-mono text-xs font-semibold tracking-widest uppercase";
export const BOX = "border-border flex flex-col gap-3 border p-3";
// every button in tweaks in the theme's accent so they read as buttons, without touching a picked option or tab
export const ACCENT_BUTTONS = [
  "[&_[data-variant=default]]:text-primary",
  "[&_[data-variant=default]:hover]:text-foreground",
  "[&_button[aria-pressed=false]]:text-primary",
  "[&_button[aria-pressed=false]:hover]:text-foreground",
].join(" ");

export const THEMES = [
  { id: "capy", label: "capy", bg: "#fdf6e3", fg: "#7c4b2a" },
  { id: "light", label: "light", bg: "#ffffff", fg: "#0a0a0a" },
  { id: "dark", label: "dark", bg: "#0a0a0a", fg: "#fafafa" },
  { id: "gruvbox", label: "gruvbox", bg: "#282828", fg: "#d79921" },
  { id: "gruvbox-light", label: "gruvbox light", bg: "#f5efdc", fg: "#3d3627" },
  { id: "gruvbox-dark-2", label: "gruvbox dark", bg: "#1c1917", fg: "#c8b89a" },
  { id: "terminal", label: "terminal", bg: "#000000", fg: "#00ff41" },
  { id: "everforest-dark", label: "everforest", bg: "#232923", fg: "#ddd8c3" },
  { id: "tokyonight", label: "tokyo night", bg: "#1a1f35", fg: "#c8ceea" },
  { id: "rosepine", label: "rosé pine dawn", bg: "#f2f0f4", fg: "#2a2437" },
  { id: "rosepine-dark", label: "rosé pine", bg: "#191724", fg: "#e0daf0" },
  { id: "nord", label: "nord", bg: "#2e3440", fg: "#b4bed2" },
  { id: "dracula", label: "dracula", bg: "#21222c", fg: "#f4f3e9" },
  { id: "solarized-dark", label: "solarized", bg: "#001a1a", fg: "#e8ddb8" },
  { id: "catppuccin-mocha", label: "catppuccin", bg: "#1e1e2e", fg: "#cdd6f4" },
  { id: "one-dark", label: "one dark", bg: "#282c34", fg: "#abb2bf" },
  { id: "nightowl", label: "night owl", bg: "#011627", fg: "#d6f0fd" },
  { id: "midnight", label: "midnight", bg: "#000000", fg: "#999999" },
] as const;

export type UserTone = "chill" | "professional" | "motivational" | "rude_funny" | "custom";
export type AIProvider = "ollama" | "openai" | "anthropic" | "groq" | "gemini";
// a saved key stays when switching to heycapy ai
export type AISource = "heycapy" | "own";
export const AI_SOURCE_OPTIONS: { value: AISource; label: string }[] = [
  { value: "heycapy", label: "heycapy ai" },
  { value: "own", label: "your own key" },
];

export const TONE_OPTIONS: { value: UserTone; label: string }[] = [
  { value: "chill", label: "chill" },
  { value: "professional", label: "professional" },
  { value: "motivational", label: "motivational" },
  { value: "custom", label: "custom" },
];

// NOTE: will have someone of my tones i enjoyed testing
export const FAVORITE_TONE_OPTIONS: { value: UserTone; label: string }[] = [
  { value: "rude_funny", label: "rude & funny" },
];

export const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: "ollama", label: "ollama" },
  { value: "openai", label: "openai" },
  { value: "anthropic", label: "anthropic" },
  { value: "groq", label: "groq" },
  { value: "gemini", label: "gemini" },
];

export const PROVIDER_DEFAULT_MODELS: Record<AIProvider, string> = {
  ollama: "llama3.2",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
  groq: "openai/gpt-oss-120b",
  gemini: GEMINI_DEFAULT_MODEL,
};

export type { TranscriptionProvider } from "@/constants";
export { TRANSCRIPTION_DEFAULT_MODELS } from "@/constants";

export const TRANSCRIPTION_PROVIDER_OPTIONS: { value: TranscriptionProvider; label: string }[] = [
  { value: "groq", label: "groq" },
  { value: "openai", label: "openai" },
  { value: "gemini", label: "gemini" },
];

export const TELEGRAM_QR_SIZE = 144;

export const DEFAULT_QUIET_FROM = "22:00";
export const DEFAULT_QUIET_TO = "07:00";
