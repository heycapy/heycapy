export type Role = "user" | "assistant" | "system";

export type Message = {
  role: Role;
  content: string;
};

export type AIProvider = {
  chat(messages: Message[]): AsyncIterable<string>;
};
