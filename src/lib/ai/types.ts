export type Role = "user" | "assistant" | "system";

export type Message = {
  role: Role;
  content: string;
};

export type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export type Tool = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  extraContent?: unknown;
};

// Null when the provider didn't report it
// inputTokens counts every prompt token, including those read from or written to a cache
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} | null;

export type CompleteResult = {
  content: string | null;
  toolCalls: ToolCall[];
  usage: TokenUsage;
};

export type ChatResult = {
  text: string;
  usage: TokenUsage;
};

export type AIProvider = {
  chat(messages: Message[]): Promise<ChatResult>;
  complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult>;
};
