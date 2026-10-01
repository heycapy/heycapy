import type { AIProviderName, TranscriptionProvider } from "@/constants";
import { isE2ETestMode } from "@/lib/e2e";
import type { TokenUsage } from "./types";

export type Price = { input: number; cachedInput: number; output: number };
export type TierModel<P extends AIProviderName = AIProviderName> = {
  provider: P;
  model: string;
  price: Price;
};
type Tier<P extends AIProviderName> = { primary: TierModel<P>; fallback?: TierModel<P> };
export type Tiers = { quick: Tier<AIProviderName>; voice: Tier<TranscriptionProvider> };

// millionths of a dollar so sums stay whole numbers; calls that reported no tokens count as free
export function costMicros(price: Price, calls: TokenUsage[]): number {
  let total = 0;
  for (const c of calls) {
    if (!c) continue;
    total +=
      (c.inputTokens - c.cacheReadTokens) * price.input +
      c.cacheReadTokens * price.cachedInput +
      c.outputTokens * price.output;
  }
  return Math.round(total);
}

//TODO: needs to keep this updated
const GEMINI_FLASH_LITE: Price = { input: 0.3, cachedInput: 0.03, output: 2.5 };

// what hosted servers answer with; a model changes here together with its price
export const AI_TIERS: Tiers = {
  quick: {
    primary: { provider: "gemini", model: "gemini-3.5-flash-lite", price: GEMINI_FLASH_LITE },
  },
  voice: {
    primary: { provider: "gemini", model: "gemini-3.5-flash-lite", price: GEMINI_FLASH_LITE },
  },
};

// e2e runs hosted against a local stand in so no test reaches a real provider
const E2E_TIERS: Tiers = {
  ...AI_TIERS,
  quick: { primary: { provider: "ollama", model: "e2e", price: GEMINI_FLASH_LITE } },
};

export function serverTiers(): Tiers {
  return isE2ETestMode() ? E2E_TIERS : AI_TIERS;
}

export const PROVIDER_KEY_ENV = {
  ollama: "OLLAMA_URL",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
} as const satisfies Record<AIProviderName, string>;

export function providerKey(provider: AIProviderName): string | null {
  return process.env[PROVIDER_KEY_ENV[provider]] || null;
}

// a hosted server refuses to start without a key for every model its tiers can use
export function missingTierKeys(tiers: Tiers = serverTiers()): string[] {
  const models = [tiers.quick, tiers.voice].flatMap((t) =>
    t.fallback ? [t.primary, t.fallback] : [t.primary]
  );
  const names = new Set(models.map((m) => PROVIDER_KEY_ENV[m.provider]));
  return [...names].filter((name) => !process.env[name]);
}
