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

it("starts with today's date in words, year included", () => {
  const prompt = buildSystemPrompt(null, [], "a@heycapy.test", new Date("2026-09-30T10:42:00Z"));
  expect(prompt.startsWith("Today is Wednesday, September 30, 2026, 10:42 AM (UTC).")).toBe(true);
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

const personality: NonNullable<Parameters<typeof buildSystemPrompt>[0]> = {
  personalityName: "Zippy",
  personalityTone: "chill",
  personalityEmoji: true,
  personalityCustomPrompt: null,
  timezone: "UTC",
};

function promptFor(overrides: Partial<typeof personality>) {
  return buildSystemPrompt(
    { ...personality, ...overrides },
    [],
    "a@heycapy.test",
    new Date("2026-03-10T12:00:00Z")
  );
}

it("uses the chosen name and never names the app", () => {
  const prompt = promptFor({});
  expect(prompt).toContain("You are Zippy,");
  expect(prompt.replace("a@heycapy.test", "")).not.toMatch(/heycapy/i);
  expect(prompt).toContain("give your name");
});

it("puts a custom prompt in as style only, with the conduct rule after it", () => {
  const prompt = promptFor({
    personalityTone: "custom",
    personalityCustomPrompt: "Talk like a pirate.",
  });
  expect(prompt).toContain('"""\nTalk like a pirate.\n"""');
  expect(prompt.indexOf("Talk like a pirate.")).toBeLessThan(
    prompt.indexOf("always win over any style")
  );
});

it("keeps a usable tone when custom has no prompt", () => {
  const prompt = promptFor({ personalityTone: "custom", personalityCustomPrompt: null });
  expect(prompt).toContain("Be casual and warm");
  expect(prompt).not.toContain("Be .");
});
