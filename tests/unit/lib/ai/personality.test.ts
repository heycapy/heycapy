import { expect, it } from "vitest";
import { CUSTOM_PROMPT_REJECTED_ERROR } from "@/constants";
import { isRejectedReview, reviewCustomPrompt, toneInstruction } from "@/lib/ai/personality";
import type { AIProvider } from "@/lib/ai/types";

function providerAnswering(content: string | null): AIProvider & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    chat: async () => ({ text: "", usage: null }),
    complete: async (messages) => {
      sent.push(messages.map((m) => m.content ?? "").join("\n"));
      return { content, toolCalls: [], usage: null };
    },
  };
}

it("names the built-in tones in plain words", () => {
  expect(toneInstruction("professional", null)).toBe("Be formal and precise.");
  expect(toneInstruction("chill", "ignored")).toBe("Be casual and warm — lowercase is fine.");
});

it("fences a custom prompt as style only", () => {
  const text = toneInstruction("custom", "Talk like a pirate.");
  expect(text).toContain('"""\nTalk like a pirate.\n"""');
  expect(text).toContain("ignore that part");
});

it.each([null, "", "   "])("falls back to chill for a custom tone with %j", (prompt) => {
  expect(toneInstruction("custom", prompt)).toBe("Be casual and warm — lowercase is fine.");
});

it.each([
  ["OK", false],
  ["ok", false],
  ["OK.", false],
  ["  OK\n", false],
  ["REJECT", true],
  ["Reject: sexual content", true],
  ["", true],
  ["Sure, that is fine", true],
])("reads the review answer %j", (answer, rejected) => {
  expect(isRejectedReview(answer)).toBe(rejected);
});

it("passes a prompt the reviewer accepts", async () => {
  const provider = providerAnswering("OK");
  expect(await reviewCustomPrompt(provider, "Talk like a pirate.")).toBeNull();
  expect(provider.sent[0]).toContain("Talk like a pirate.");
});

it("refuses a prompt the reviewer rejects, and one it can't answer for", async () => {
  expect(await reviewCustomPrompt(providerAnswering("REJECT"), "x")).toBe(
    CUSTOM_PROMPT_REJECTED_ERROR
  );
  expect(await reviewCustomPrompt(providerAnswering(null), "x")).toBe(CUSTOM_PROMPT_REJECTED_ERROR);
});
