export const HEADER_H = 40;
export const DEFAULT_W = 308;
export const DEFAULT_H = 420;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stopped?: boolean;
};

export const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content: "Hi there, am capy... how can I help you today?",
};

export type Pos = { x: number; y: number };
