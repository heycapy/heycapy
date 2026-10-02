import { z } from "zod";
import { AI_MODEL_MAX_LENGTH, AI_PROVIDERS, SETTINGS_API_KEY_MAX_LENGTH } from "@/constants";
import { decryptValue, encryptValue } from "@/lib/crypto";

export type AIProviderName = (typeof AI_PROVIDERS)[number];

export const SavedAIKeysSchema = z.partialRecord(
  z.enum(AI_PROVIDERS),
  z.object({
    apiKey: z.string().max(SETTINGS_API_KEY_MAX_LENGTH).nullable(),
    model: z.string().max(AI_MODEL_MAX_LENGTH).nullable(),
  })
);

export type SavedAIKeys = z.infer<typeof SavedAIKeysSchema>;

export function readSavedAIKeys(raw: string | null | undefined): SavedAIKeys {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const result = SavedAIKeysSchema.safeParse(parsed);
  if (!result.success) return {};
  const keys: SavedAIKeys = {};
  for (const provider of AI_PROVIDERS) {
    const entry = result.data[provider];
    if (!entry) continue;
    try {
      keys[provider] = { apiKey: entry.apiKey && decryptValue(entry.apiKey), model: entry.model };
    } catch {
      // a key encrypted with an older ENCRYPTION_KEY can't be read; keep the model at least
      keys[provider] = { apiKey: null, model: entry.model };
    }
  }
  return keys;
}

export function storeSavedAIKeys(keys: SavedAIKeys): string | null {
  const stored: SavedAIKeys = {};
  for (const provider of AI_PROVIDERS) {
    const apiKey = keys[provider]?.apiKey || null;
    const model = keys[provider]?.model || null;
    if (!apiKey && !model) continue;
    stored[provider] = { apiKey: apiKey && encryptValue(apiKey), model };
  }
  return Object.keys(stored).length > 0 ? JSON.stringify(stored) : null;
}
