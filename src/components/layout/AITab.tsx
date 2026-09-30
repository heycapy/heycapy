import { useState } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import {
  LABEL,
  INPUT,
  PROVIDER_OPTIONS,
  PROVIDER_DEFAULT_MODELS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  TRANSCRIPTION_DEFAULT_MODELS,
} from "./settings-constants";
import type { AIProvider, TranscriptionProvider } from "./settings-constants";
import {
  OLLAMA_DEFAULT_URL,
  SETTINGS_URL_MAX_LENGTH,
  SETTINGS_API_KEY_MAX_LENGTH,
  AI_MODEL_MAX_LENGTH,
  AI_COMPACT_THRESHOLD_MIN,
  AI_COMPACT_THRESHOLD_MAX,
} from "@/constants";

type AITabProps = {
  aiProvider: AIProvider;
  setAiProvider: (v: AIProvider) => void;
  aiApiKey: string;
  setAiApiKey: (v: string) => void;
  aiModel: string;
  setAiModel: (v: string) => void;
  aiOllamaUrl: string;
  setAiOllamaUrl: (v: string) => void;
  aiCompactThreshold: number;
  setAiCompactThreshold: (v: number) => void;
  aiNotifyMessages: boolean;
  setAiNotifyMessages: (v: boolean) => void;
  transcriptionProvider: TranscriptionProvider | null;
  setTranscriptionProvider: (v: TranscriptionProvider | null) => void;
  transcriptionApiKey: string;
  setTranscriptionApiKey: (v: string) => void;
  transcriptionModel: string;
  setTranscriptionModel: (v: string) => void;
  pending: boolean;
};

export function AITab({
  aiProvider,
  setAiProvider,
  aiApiKey,
  setAiApiKey,
  aiModel,
  setAiModel,
  aiOllamaUrl,
  setAiOllamaUrl,
  aiCompactThreshold,
  setAiCompactThreshold,
  aiNotifyMessages,
  setAiNotifyMessages,
  transcriptionProvider,
  setTranscriptionProvider,
  transcriptionApiKey,
  setTranscriptionApiKey,
  transcriptionModel,
  setTranscriptionModel,
  pending,
}: AITabProps) {
  const [aiSubTab, setAiSubTab] = useState<"chat" | "voice">("chat");

  const subTabBtn = (t: "chat" | "voice") =>
    cn(
      "font-mono text-xs px-2 py-0.5 transition-colors",
      aiSubTab === t
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <>
      <div className="flex gap-0">
        <button className={subTabBtn("chat")} onClick={() => setAiSubTab("chat")}>
          chat
        </button>
        <button className={subTabBtn("voice")} onClick={() => setAiSubTab("voice")}>
          voice
        </button>
      </div>

      {aiSubTab === "chat" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>provider</label>
            <OptionGroup
              options={PROVIDER_OPTIONS}
              value={aiProvider}
              onChange={setAiProvider}
              disabled={pending}
            />
          </div>
          {aiProvider === "ollama" && (
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>ollama url</label>
              <input
                type="text"
                value={aiOllamaUrl}
                onChange={(e) => setAiOllamaUrl(e.target.value)}
                placeholder={OLLAMA_DEFAULT_URL}
                maxLength={SETTINGS_URL_MAX_LENGTH}
                disabled={pending}
                className={INPUT}
              />
              {aiOllamaUrl.length > 0 && (
                <p
                  className={cn(
                    "mt-0.5 text-right font-mono text-[11px] transition-colors",
                    charCountColor(aiOllamaUrl.length, SETTINGS_URL_MAX_LENGTH)
                  )}
                >
                  {aiOllamaUrl.length}/{SETTINGS_URL_MAX_LENGTH}
                </p>
              )}
            </div>
          )}
          {aiProvider !== "ollama" && (
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>api key</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                maxLength={SETTINGS_API_KEY_MAX_LENGTH}
                disabled={pending}
                className={INPUT}
              />
              {aiApiKey.length > 0 && (
                <p
                  className={cn(
                    "mt-0.5 text-right font-mono text-[11px] transition-colors",
                    charCountColor(aiApiKey.length, SETTINGS_API_KEY_MAX_LENGTH)
                  )}
                >
                  {aiApiKey.length}/{SETTINGS_API_KEY_MAX_LENGTH}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>model</label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={PROVIDER_DEFAULT_MODELS[aiProvider]}
              maxLength={AI_MODEL_MAX_LENGTH}
              disabled={pending}
              className={INPUT}
            />
            {aiModel.length > 0 && (
              <p
                className={cn(
                  "mt-0.5 text-right font-mono text-[11px] transition-colors",
                  charCountColor(aiModel.length, AI_MODEL_MAX_LENGTH)
                )}
              >
                {aiModel.length}/{AI_MODEL_MAX_LENGTH}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>autocompact after</label>
            <input
              type="number"
              value={aiCompactThreshold}
              onChange={(e) =>
                setAiCompactThreshold(
                  Math.max(AI_COMPACT_THRESHOLD_MIN, parseInt(e.target.value) || 40)
                )
              }
              placeholder="40"
              min={AI_COMPACT_THRESHOLD_MIN}
              max={AI_COMPACT_THRESHOLD_MAX}
              disabled={pending}
              className={INPUT}
            />
            <span className="text-muted-foreground font-mono text-[11px]">
              messages before compacting chat history — increase for more powerful models
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>ai notification messages</label>
            <Toggle value={aiNotifyMessages} onChange={setAiNotifyMessages} disabled={pending} />
            <span className="text-muted-foreground font-mono text-[11px]">
              generate notification text with AI — may add delay depending on your model and
              provider
            </span>
          </div>
        </>
      )}

      {aiSubTab === "voice" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>provider</label>
            <OptionGroup
              options={[{ value: "none", label: "off" }, ...TRANSCRIPTION_PROVIDER_OPTIONS]}
              value={transcriptionProvider ?? "none"}
              onChange={(v) =>
                setTranscriptionProvider(v === "none" ? null : (v as TranscriptionProvider))
              }
              disabled={pending}
            />
          </div>
          {transcriptionProvider && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>
                  api key
                  {transcriptionProvider === aiProvider && (
                    <span className="text-muted-foreground ml-1">
                      (leave blank to reuse chat key)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={transcriptionApiKey}
                  onChange={(e) => setTranscriptionApiKey(e.target.value)}
                  placeholder="sk-..."
                  maxLength={SETTINGS_API_KEY_MAX_LENGTH}
                  disabled={pending}
                  className={INPUT}
                />
                {transcriptionApiKey.length > 0 && (
                  <p
                    className={cn(
                      "mt-0.5 text-right font-mono text-[11px] transition-colors",
                      charCountColor(transcriptionApiKey.length, SETTINGS_API_KEY_MAX_LENGTH)
                    )}
                  >
                    {transcriptionApiKey.length}/{SETTINGS_API_KEY_MAX_LENGTH}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>model</label>
                <input
                  type="text"
                  value={transcriptionModel}
                  onChange={(e) => setTranscriptionModel(e.target.value)}
                  placeholder={TRANSCRIPTION_DEFAULT_MODELS[transcriptionProvider]}
                  maxLength={AI_MODEL_MAX_LENGTH}
                  disabled={pending}
                  className={INPUT}
                />
                {transcriptionModel.length > 0 && (
                  <p
                    className={cn(
                      "mt-0.5 text-right font-mono text-[11px] transition-colors",
                      charCountColor(transcriptionModel.length, AI_MODEL_MAX_LENGTH)
                    )}
                  >
                    {transcriptionModel.length}/{AI_MODEL_MAX_LENGTH}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
