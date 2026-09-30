import { useCallback, useState } from "react";
import type { userSettings } from "@/lib/db/schema";
import type { AIProvider, TranscriptionProvider } from "./settings-constants";

type Settings = typeof userSettings.$inferSelect;

export function useAISettings() {
  const [hosted, setHosted] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(true);
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [compactThreshold, setCompactThreshold] = useState(40);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider | null>(
    null
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState("");

  const populate = useCallback((s: Settings, hostedServer: boolean) => {
    setHosted(hostedServer);
    setUseOwnKey(!hostedServer || (s.aiUseOwnKey && s.aiProvider !== null));
    setProvider(
      s.aiProvider && !(hostedServer && s.aiProvider === "ollama")
        ? s.aiProvider
        : hostedServer
          ? "gemini"
          : "ollama"
    );
    setApiKey(s.aiApiKey ?? "");
    setModel(s.aiModel ?? "");
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
