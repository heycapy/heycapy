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
};

export type CompleteResult = {
  content: string | null;
  toolCalls: ToolCall[];
};

export type AIProvider = {
  chat(messages: Message[]): AsyncIterable<string>;
  complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult>;
};
