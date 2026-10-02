import { useCallback, useState } from "react";
import type { userSettings } from "@/lib/db/schema";
import type { SavedAIKeys } from "@/lib/ai/saved-keys";
import type { AIProvider, TranscriptionProvider } from "./settings-constants";

type Settings = typeof userSettings.$inferSelect;

export function useAISettings() {
  const [hosted, setHosted] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(true);
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [keys, setKeys] = useState<SavedAIKeys>({});
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [compactThreshold, setCompactThreshold] = useState(40);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider | null>(
    null
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");

  const apiKey = keys[provider]?.apiKey ?? "";
  const model = keys[provider]?.model ?? "";

  function setApiKey(value: string) {
    setKeys((k) => ({ ...k, [provider]: { apiKey: value, model: k[provider]?.model ?? null } }));
  }

  // the provider's entry goes away on save, so its key isn't kept anywhere
  function clearProvider() {
    setKeys((k) => ({ ...k, [provider]: { apiKey: null, model: null } }));
    if (provider === "ollama") setOllamaUrl("");
  }

  function hasKeyFor(p: AIProvider): boolean {
    return !!keys[p]?.apiKey;
  }

  function setModel(value: string) {
    setKeys((k) => ({ ...k, [provider]: { apiKey: k[provider]?.apiKey ?? null, model: value } }));
  }

  const populate = useCallback((s: Settings, hostedServer: boolean, saved: SavedAIKeys) => {
    setHosted(hostedServer);
    setUseOwnKey(!hostedServer || (s.aiUseOwnKey && s.aiProvider !== null));
    setProvider(
      s.aiProvider && !(hostedServer && s.aiProvider === "ollama")
        ? s.aiProvider
        : hostedServer
          ? "gemini"
          : "ollama"
    );
    setKeys(saved);
    setOllamaUrl(s.aiOllamaUrl ?? "");
    setCompactThreshold(s.aiCompactThreshold ?? 40);
    setNotifyMessages(s.aiNotifyMessages ?? true);
    setTranscriptionProvider((s.transcriptionProvider as TranscriptionProvider | null) ?? null);
    setTranscriptionApiKey(s.transcriptionApiKey ?? "");
    setTranscriptionModel(s.transcriptionModel ?? "");
  }, []);

  function payload() {
    return {
      aiProvider: provider,
      aiApiKey: apiKey || null,
      aiModel: model || null,
      aiSavedKeys: keys,
      aiOllamaUrl: ollamaUrl || null,
      aiUseOwnKey: !hosted || useOwnKey,
      aiCompactThreshold: compactThreshold,
      aiNotifyMessages: notifyMessages,
      transcriptionProvider: transcriptionProvider || null,
      transcriptionApiKey: transcriptionApiKey || null,
      transcriptionModel: transcriptionModel || null,
    };
  }

  return {
    hosted,
    useOwnKey,
    setUseOwnKey,
    provider,
    setProvider,
    apiKey,
    setApiKey,
    model,
    setModel,
    hasKeyFor,
    clearProvider,
    ollamaUrl,
    setOllamaUrl,
    compactThreshold,
    setCompactThreshold,
    notifyMessages,
    setNotifyMessages,
    transcriptionProvider,
    setTranscriptionProvider,
    transcriptionApiKey,
    setTranscriptionApiKey,
    transcriptionModel,
    setTranscriptionModel,
    populate,
    payload,
  };
}

export type AISettings = ReturnType<typeof useAISettings>;
