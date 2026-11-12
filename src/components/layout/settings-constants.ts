import {
  CONTROL_SIZE,
  GEMINI_DEFAULT_MODEL,
  LOOK,
  TEXT_SIZE,
  TICK_SOUND_OFF,
  type TranscriptionProvider,
} from "@/constants";
import type { ControlSize, Look, TextSize, TickSound } from "@/components/looks/constants";
import { SOUND_IDS, SOUNDS } from "@/lib/sounds";

export const LABEL = "text-foreground font-ui text-xs font-medium";
export const HINT = "text-muted-foreground font-ui text-2xs leading-tight";

export const SUBHEAD = "text-muted-foreground font-ui text-2xs";
export const MUTED = "text-muted-foreground font-ui text-xs";
export const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-ui text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

export const SECTION = "text-foreground font-ui text-xs font-semibold section-case";
export const BOX = "rounded-control border-border box flex flex-col gap-4";
export const USERNAME_CHECK_DEBOUNCE_MS = 400;
// every button in tweaks in the theme's accent so they read as buttons, without touching a picked option or tab
export const ACCENT_BUTTONS = [
  "[&_[data-variant=default]]:text-(--button-accent)",
  "[&_[data-variant=default]:hover]:text-foreground",
  "[&_[data-variant=destructive]]:text-(--button-accent)",
  "[&_[data-variant=destructive]:hover]:text-destructive",
  "[&_[data-variant=warning]]:text-(--button-accent)",
  "[&_[data-variant=warning]:hover]:text-warning",
  "[&_button[aria-pressed=false]]:text-(--button-accent)",
  "[&_button[aria-pressed=false]:hover]:text-foreground",
].join(" ");

export const THEMES = [
  { id: "capy", label: "capy", bg: "#fdf6e3", accent: "#7c4b2a" },
  { id: "light", label: "light", bg: "#ffffff", accent: "#171717" },
  { id: "dark", label: "dark", bg: "#0a0a0a", accent: "#fafafa" },
  { id: "gruvbox", label: "gruvbox", bg: "#282828", accent: "#d79921" },
  { id: "gruvbox-light", label: "gruvbox light", bg: "#fbf1c7", accent: "#8b5b0f" },
  { id: "gruvbox-dark-2", label: "gruvbox dark", bg: "#1d1816", accent: "#c49331" },
  { id: "terminal", label: "terminal", bg: "#000000", accent: "#00ff41" },
  { id: "everforest-dark", label: "everforest", bg: "#2d353b", accent: "#a7c080" },
  { id: "tokyonight", label: "tokyo night", bg: "#1a1b26", accent: "#7aa2f7" },
  { id: "rosepine", label: "rosé pine dawn", bg: "#faf4ed", accent: "#79668e" },
  { id: "rosepine-dark", label: "rosé pine", bg: "#191724", accent: "#c4a7e7" },
  { id: "nord", label: "nord", bg: "#2e3440", accent: "#88c0d0" },
  { id: "dracula", label: "dracula", bg: "#282a36", accent: "#ff79c6" },
  { id: "solarized-dark", label: "solarized", bg: "#002b36", accent: "#3faaa2" },
  { id: "catppuccin-mocha", label: "catppuccin", bg: "#1e1e2e", accent: "#74c7ec" },
  { id: "one-dark", label: "one dark", bg: "#282c34", accent: "#61afef" },
  { id: "nightowl", label: "night owl", bg: "#011627", accent: "#7fdbca" },
  { id: "midnight", label: "midnight", bg: "#000000", accent: "#8077bb" },
  { id: "kanagawa", label: "kanagawa", bg: "#1f1f28", accent: "#7e9cd8" },
  { id: "kanagawa-light", label: "kanagawa light", bg: "#f2ecbc", accent: "#46608d" },
  { id: "melange", label: "melange", bg: "#292522", accent: "#ebc06d" },
] as const;

export type UserTone = "chill" | "professional" | "motivational" | "rude_funny" | "custom";
export type AIProvider = "ollama" | "openai" | "anthropic" | "groq" | "gemini";
// a saved key stays when switching to heycapy ai
export type AISource = "heycapy" | "own";
export const AI_SOURCE_OPTIONS: { value: AISource; label: string }[] = [
  { value: "heycapy", label: "heycapy ai" },
  { value: "own", label: "your own key" },
];

export const NOTIFICATION_SECTIONS = [
  "reminders",
  "email",
  "push",
  "ntfy",
  "telegram",
  "other apps",
] as const;
export type NotificationSection = (typeof NOTIFICATION_SECTIONS)[number];

export const CONTROL_SIZE_OPTIONS: { value: ControlSize; label: string }[] = [
  { value: CONTROL_SIZE.small, label: "small" },
  { value: CONTROL_SIZE.medium, label: "medium" },
  { value: CONTROL_SIZE.large, label: "large" },
];

export const TICK_SOUND_OPTIONS: { value: TickSound; label: string }[] = [
  { value: TICK_SOUND_OFF, label: "off" },
  ...SOUND_IDS.map((id) => ({ value: id, label: SOUNDS[id].label })),
];

export const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: TEXT_SIZE.default, label: "default" },
  { value: TEXT_SIZE.large, label: "large" },
  { value: TEXT_SIZE.larger, label: "larger" },
];

export const LOOK_OPTIONS: { value: Look; label: string }[] = [
  { value: LOOK.original, label: "original" },
  { value: LOOK.modern, label: "modern" },
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
