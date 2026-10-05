import type { AIStatus } from "./status";

export function creditsLabel(balance: number): string {
  return balance > 0 ? `capy credits · ${balance} left` : "out of capy credits";
}

export function aiStatusLabel(status: AIStatus): string {
  if (status.kind === "credits") return creditsLabel(status.balance);
  if (status.kind === "server") return `server ai · ${status.provider}`;
  if (status.kind === "none") return "no ai set up";
  const source =
    status.provider === "ollama" ? "your ollama server" : `your ${status.provider} key`;
  const state =
    status.status === "working" ? "working" : status.status === "failed" ? "failed" : "not checked";
  return `${source} · ${state}`;
}

export function aiStatusIsProblem(status: AIStatus): boolean {
  return (
    status.kind === "none" ||
    (status.kind === "credits" && status.balance <= 0) ||
    (status.kind === "own" && status.status === "failed")
  );
}
