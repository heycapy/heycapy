import { afterEach, expect, it, vi } from "vitest";
import { AI_TIERS, costMicros, missingTierKeys, PROVIDER_KEY_ENV } from "@/lib/ai/tiers";

afterEach(() => {
  vi.unstubAllEnvs();
});

const models = [AI_TIERS.quick, AI_TIERS.voice].flatMap((t) =>
  t.fallback ? [t.primary, t.fallback] : [t.primary]
);

it.each(models.map((m) => [`${m.provider} ${m.model}`, m.price] as const))(
  "%s has a real price",
  (_, price) => {
    expect(price.input).toBeGreaterThan(0);
    expect(price.output).toBeGreaterThan(0);
    expect(price.cachedInput).toBeGreaterThanOrEqual(0);
    expect(price.cachedInput).toBeLessThanOrEqual(price.input);
  }
);

it("prices cached input at its own rate and skips calls without a count", () => {
  const price = { input: 0.3, cachedInput: 0.03, output: 2.5 };
  const calls = [
    { inputTokens: 10_000, outputTokens: 100, cacheReadTokens: 4_000, cacheWriteTokens: 0 },
    null,
  ];
  // 6000 × 0.30 + 4000 × 0.03 + 100 × 2.50
  expect(costMicros(price, calls)).toBe(2170);
});

it("names every key the tiers need that isn't set", () => {
  for (const name of Object.values(PROVIDER_KEY_ENV)) vi.stubEnv(name, "");
  const needed = [...new Set(models.map((m) => PROVIDER_KEY_ENV[m.provider]))];
  expect(missingTierKeys(AI_TIERS)).toEqual(needed);

  for (const name of needed) vi.stubEnv(name, "set");
  expect(missingTierKeys(AI_TIERS)).toEqual([]);
});
