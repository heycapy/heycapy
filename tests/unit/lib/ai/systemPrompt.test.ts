import { afterEach, expect, it, vi } from "vitest";
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

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["web", "write each item's name as a markdown link"],
  ["telegram", "only when the user asks for a link"],
] as const)("on %s, gives item links the way that chat shows them", (channel, rule) => {
  vi.stubEnv("APP_URL", "https://app.heycapy.test");
  const prompt = buildSystemPrompt(null, [], "a@heycapy.test", new Date(), [], channel);
  expect(prompt).toContain(rule);
});

it.each(["web", "telegram"] as const)(
  "on %s, says items have no links when the app has no address",
  (channel) => {
    vi.stubEnv("APP_URL", "");
    const prompt = buildSystemPrompt(null, [], "a@heycapy.test", new Date(), [], channel);
    expect(prompt).toContain("Items have no links");
    expect(prompt).not.toContain("markdown link");
    expect(prompt).not.toContain("only when the user asks for a link");
  }
);

it.each([
  ["web", "use a markdown table with a header row"],
  ["telegram", "markdown isn't rendered: no tables"],
] as const)("on %s, formats replies the way that chat shows them", (channel, rule) => {
  const prompt = buildSystemPrompt(null, [], "a@heycapy.test", new Date(), [], channel);
  expect(prompt).toContain(rule);
});

it("lists each bucket's custom fields with the keys to save them under", () => {
  const fieldSchema = JSON.stringify({
    fields: [
      { key: "monthly_cost", label: "Monthly cost", type: "currency", currency: "INR" },
      { key: "plan", label: "Plan", type: "select", options: ["basic", "pro"] },
    ],
  });
  const prompt = buildSystemPrompt(
    null,
    [
      { id: 1, name: "Subscriptions", icon: null, fieldSchema },
      { id: 2, name: "Tasks", icon: null },
    ],
    "a@heycapy.test",
    new Date("2026-03-10T12:00:00Z")
  );
  expect(prompt).toContain(
    '- "Subscriptions" (id: 1)\n' +
      "  fields: Monthly cost (key monthly_cost, currency INR); Plan (key plan, select: basic | pro)\n" +
      '- "Tasks" (id: 2)\n'
  );
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

it("treats several names as one item each and never copies one value to all of them", () => {
  const prompt = buildSystemPrompt(null, [], "a@heycapy.test", new Date());
  expect(prompt).toContain("are one item each");
  expect(prompt).toContain("never join two into one title, and never drop one");
  expect(prompt).toContain("save nothing yet and ask whether it's for each of them");
});
