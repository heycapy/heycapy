import { useCallback, useState } from "react";
import type { userSettings } from "@/lib/db/schema";
import type { AIKeyEdits, AIKeyViews, KeyView } from "@/lib/ai/saved-keys";
import type { AIProvider, TranscriptionProvider } from "./settings-constants";

type Settings = typeof userSettings.$inferSelect;

type KeyState = KeyView & { newKey: string; clear: boolean; editing: boolean };
type ProviderState = KeyState & { model: string };

const NO_KEY: KeyState = {
  hasKey: false,
  keyEnding: null,
  newKey: "",
  clear: false,
  editing: false,
};

function keyField(key: KeyState) {
  return {
    saved: key.hasKey && !key.clear,
    keyEnding: key.keyEnding,
    editing: key.editing,
    value: key.newKey,
  };
}

function keySet(key: KeyState): boolean {
  return !!key.newKey || (key.hasKey && !key.clear);
}

export function useAISettings() {
  const [hosted, setHosted] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(true);
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [keys, setKeys] = useState<Partial<Record<AIProvider, ProviderState>>>({});
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [compactThreshold, setCompactThreshold] = useState(40);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider | null>(
    null
  );
  const [transcriptionKey, setTranscriptionKey] = useState<KeyState>(NO_KEY);
  const [transcriptionModel, setTranscriptionModel] = useState("");

  const current: ProviderState = keys[provider] ?? { ...NO_KEY, model: "" };

  function updateCurrent(change: Partial<ProviderState>) {
    setKeys((k) => ({
      ...k,
      [provider]: { ...(k[provider] ?? { ...NO_KEY, model: "" }), ...change },
    }));
  }

  function clearProvider() {
    updateCurrent({ newKey: "", clear: true, editing: false, model: "" });
    if (provider === "ollama") setOllamaUrl("");
  }

  function hasKeyFor(p: AIProvider): boolean {
    const state = keys[p];
    return !!state && keySet(state);
  }

  const populate = useCallback(
    (s: Settings, hostedServer: boolean, aiKeys: AIKeyViews, savedTranscriptionKey: KeyView) => {
      setHosted(hostedServer);
      setUseOwnKey(!hostedServer || (s.aiUseOwnKey && s.aiProvider !== null));
      setProvider(s.aiProvider ?? (hostedServer ? "gemini" : "ollama"));
      const loaded: Partial<Record<AIProvider, ProviderState>> = {};
      for (const [p, view] of Object.entries(aiKeys) as [AIProvider, AIKeyViews[AIProvider]][]) {
        if (view) loaded[p] = { ...NO_KEY, ...view, model: view.model ?? "" };
      }
      setKeys(loaded);
      setOllamaUrl(s.aiOllamaUrl ?? "");
      setCompactThreshold(s.aiCompactThreshold ?? 40);
      setNotifyMessages(s.aiNotifyMessages ?? true);
      setTranscriptionProvider((s.transcriptionProvider as TranscriptionProvider | null) ?? null);
      setTranscriptionKey({ ...NO_KEY, ...savedTranscriptionKey });
      setTranscriptionModel(s.transcriptionModel ?? "");
    },
    []
  );

  function payload() {
    const aiKeyEdits: AIKeyEdits = {};
    for (const [p, state] of Object.entries(keys) as [AIProvider, ProviderState][]) {
      aiKeyEdits[p] = {
        newKey: state.newKey || null,
        clear: state.clear,
        model: state.model || null,
      };
    }
    return {
      aiProvider: provider,
      aiKeyEdits,
      aiOllamaUrl: ollamaUrl || null,
      aiUseOwnKey: !hosted || useOwnKey,
      aiCompactThreshold: compactThreshold,
      aiNotifyMessages: notifyMessages,
      transcriptionProvider: transcriptionProvider || null,
      transcriptionKeyEdit: {
        newKey: transcriptionKey.newKey || null,
        clear: transcriptionKey.clear,
      },
      transcriptionModel: transcriptionModel || null,
    };
  }

  return {
    hosted,
    useOwnKey,
    setUseOwnKey,
    provider,
    setProvider,
    apiKeyField: keyField(current),
    setApiKey: (value: string) => updateCurrent({ newKey: value }),
    editApiKey: () => updateCurrent({ editing: true, newKey: "" }),
    cancelApiKeyEdit: () => updateCurrent({ editing: false, newKey: "" }),
    model: current.model,
    setModel: (value: string) => updateCurrent({ model: value }),
    canClear: keySet(current) || !!current.model || (provider === "ollama" && !!ollamaUrl),
    clearProvider,
    hasKeyFor,
    ollamaUrl,
    setOllamaUrl,
    compactThreshold,
    setCompactThreshold,
    notifyMessages,
    setNotifyMessages,
    transcriptionProvider,
    setTranscriptionProvider,
    transcriptionKeyField: keyField(transcriptionKey),
    setTranscriptionApiKey: (value: string) =>
      setTranscriptionKey((k) => ({ ...k, newKey: value })),
    editTranscriptionKey: () => setTranscriptionKey((k) => ({ ...k, editing: true, newKey: "" })),
    cancelTranscriptionKeyEdit: () =>
      setTranscriptionKey((k) => ({ ...k, editing: false, newKey: "" })),
    canClearTranscriptionKey: keySet(transcriptionKey),
    clearTranscriptionKey: () =>
      setTranscriptionKey((k) => ({ ...k, newKey: "", clear: true, editing: false })),
    transcriptionModel,
    setTranscriptionModel,
    populate,
    payload,
  };
}

export type AISettings = ReturnType<typeof useAISettings>;
