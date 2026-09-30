// One JSON object per line of the /api/chat response
export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "reply"; text: string }
  | { type: "error"; error: string }
  | { type: "done"; sessionId: number | null };
