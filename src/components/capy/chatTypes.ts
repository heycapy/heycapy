export const HEADER_H = 40;
export const CHAT_MAX_H = 640;
// keeps the bucket tabs in view above the chat on short screens
export const CHAT_TOP_GAP = 96;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stopped?: boolean;
};

export const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content: "Hi there! How can I help you today?",
};
