import { expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";

it("tells the assistant the current time with the right UTC offset", () => {
  const prompt = buildSystemPrompt(
    {
      personalityName: "Capy",
      personalityTone: "chill",
      personalityEmoji: false,
      personalityCustomPrompt: null,
      timezone: "Asia/Kolkata",
    },
    [],
    "a@heycapy.test",
    new Date("2026-03-10T12:00:00Z")
  );
  expect(prompt).toContain("Now: 2026-03-10T17:30:00+05:30");
});

it("tells the assistant a bucket is read-only even without a default deadline", () => {
  const prompt = buildSystemPrompt(
    null,
    [{ id: 1, name: "Feed", icon: null, itemsRules: JSON.stringify({ readonly: true }) }],
    "a@heycapy.test",
    new Date("2026-03-10T12:00:00Z")
  );
  expect(prompt).toContain('- "Feed" (id: 1) [readonly]');
});
