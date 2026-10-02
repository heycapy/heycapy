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

// what the browser sees of a saved key: never the key, only that there is one and its last
// characters, so a saved key can't be read back out of the settings screen
export type KeyView = { hasKey: boolean; keyEnding: string | null };
export type AIKeyView = KeyView & { model: string | null };
export type AIKeyViews = Partial<Record<AIProviderName, AIKeyView>>;

const KEY_ENDING_LENGTH = 4;
// if key is less than 12 than no characters shown
const KEY_ENDING_MIN_LENGTH = 12;

export function keyView(key: string | null | undefined): KeyView {
  if (!key) return { hasKey: false, keyEnding: null };
  return {
    hasKey: true,
    keyEnding: key.length >= KEY_ENDING_MIN_LENGTH ? key.slice(-KEY_ENDING_LENGTH) : null,
  };
}

export function aiKeyViews(keys: SavedAIKeys): AIKeyViews {
  const views: AIKeyViews = {};
  for (const provider of AI_PROVIDERS) {
    const entry = keys[provider];
    if (entry) views[provider] = { ...keyView(entry.apiKey), model: entry.model };
  }
  return views;
}

export const KeyEditSchema = z.object({
  newKey: z.string().max(SETTINGS_API_KEY_MAX_LENGTH).nullable(),
  clear: z.boolean(),
});
export type KeyEdit = z.infer<typeof KeyEditSchema>;

export const AIKeyEditsSchema = z.partialRecord(
  z.enum(AI_PROVIDERS),
  KeyEditSchema.extend({ model: z.string().max(AI_MODEL_MAX_LENGTH).nullable() })
);
export type AIKeyEdits = z.infer<typeof AIKeyEditsSchema>;

export function applyKeyEdit(saved: string | null, edit: KeyEdit | undefined): string | null {
  if (!edit) return saved;
  return edit.newKey || (edit.clear ? null : saved);
}

export function applyAIKeyEdits(saved: SavedAIKeys, edits: AIKeyEdits): SavedAIKeys {
  const next: SavedAIKeys = { ...saved };
  for (const provider of AI_PROVIDERS) {
    const edit = edits[provider];
    if (!edit) continue;
    next[provider] = {
      apiKey: applyKeyEdit(saved[provider]?.apiKey ?? null, edit),
      model: edit.model,
    };
  }
  return next;
}

type AIKeyColumns = {
  aiSavedKeys: string | null;
  aiProvider: AIProviderName | null;
  aiApiKey: string | null;
  aiModel: string | null;
};

export function savedAIKeysOf(row: AIKeyColumns): SavedAIKeys {
  const keys = readSavedAIKeys(row.aiSavedKeys);
  const activeKey = row.aiApiKey ? decryptValue(row.aiApiKey) : null;
  if (row.aiProvider && (activeKey || row.aiModel)) {
    keys[row.aiProvider] = { apiKey: activeKey, model: row.aiModel };
  }
  return keys;
}
