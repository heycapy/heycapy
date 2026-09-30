import { useState } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { AIStatusBox } from "./AIStatusBox";
import {
  LABEL,
  INPUT,
  AI_SOURCE_OPTIONS,
  PROVIDER_OPTIONS,
  PROVIDER_DEFAULT_MODELS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  TRANSCRIPTION_DEFAULT_MODELS,
} from "./settings-constants";
import type { AISource, TranscriptionProvider } from "./settings-constants";
import type { AISettings } from "./useAISettings";
import {
  OLLAMA_DEFAULT_URL,
  SETTINGS_URL_MAX_LENGTH,
  SETTINGS_API_KEY_MAX_LENGTH,
  AI_MODEL_MAX_LENGTH,
  AI_COMPACT_THRESHOLD_MIN,
  AI_COMPACT_THRESHOLD_MAX,
} from "@/constants";

type AITabProps = {
  ai: AISettings;
  pending: boolean;
};

function CharCount({ length, max }: { length: number; max: number }) {
  if (length === 0) return null;
  return (
    <p
      className={cn(
        "mt-0.5 text-right font-mono text-[11px] transition-colors",
        charCountColor(length, max)
      )}
    >
      {length}/{max}
    </p>
  );
}

export function AITab({ ai, pending }: AITabProps) {
  const [aiSubTab, setAiSubTab] = useState<"chat" | "voice">("chat");

  const subTabBtn = (t: "chat" | "voice") =>
    cn(
      "font-mono text-xs px-2 py-0.5 transition-colors",
      aiSubTab === t
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground"
    );

  const general = (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>autocompact after</label>
        <input
          type="number"
          value={ai.compactThreshold}
          onChange={(e) =>
            ai.setCompactThreshold(
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
        <Toggle value={ai.notifyMessages} onChange={ai.setNotifyMessages} disabled={pending} />
        <span className="text-muted-foreground font-mono text-[11px]">
          generate notification text with AI — may add delay depending on your model and provider
        </span>
      </div>
    </>
  );

  return (
    <>
      {ai.hosted && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>who answers</label>
          <OptionGroup<AISource>
            options={AI_SOURCE_OPTIONS}
            value={ai.useOwnKey ? "own" : "heycapy"}
            onChange={(v) => ai.setUseOwnKey(v === "own")}
            disabled={pending}
          />
        </div>
      )}
      <AIStatusBox ownKeyPicked={ai.useOwnKey} />

      {!ai.useOwnKey && general}

      {ai.useOwnKey && (
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
                  value={ai.provider}
                  onChange={ai.setProvider}
                  disabled={pending}
                />
              </div>
              {ai.provider === "ollama" ? (
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>ollama url</label>
                  <input
                    type="text"
                    value={ai.ollamaUrl}
                    onChange={(e) => ai.setOllamaUrl(e.target.value)}
                    placeholder={OLLAMA_DEFAULT_URL}
                    maxLength={SETTINGS_URL_MAX_LENGTH}
                    disabled={pending}
                    className={INPUT}
                  />
                  <CharCount length={ai.ollamaUrl.length} max={SETTINGS_URL_MAX_LENGTH} />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>api key</label>
                  <input
                    type="password"
                    value={ai.apiKey}
                    onChange={(e) => ai.setApiKey(e.target.value)}
                    placeholder="sk-..."
                    maxLength={SETTINGS_API_KEY_MAX_LENGTH}
                    disabled={pending}
                    className={INPUT}
                  />
                  <CharCount length={ai.apiKey.length} max={SETTINGS_API_KEY_MAX_LENGTH} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>model</label>
                <input
                  type="text"
                  value={ai.model}
                  onChange={(e) => ai.setModel(e.target.value)}
                  placeholder={PROVIDER_DEFAULT_MODELS[ai.provider]}
                  maxLength={AI_MODEL_MAX_LENGTH}
                  disabled={pending}
                  className={INPUT}
                />
                <CharCount length={ai.model.length} max={AI_MODEL_MAX_LENGTH} />
              </div>
              {general}
            </>
          )}

          {aiSubTab === "voice" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>provider</label>
                <OptionGroup
                  options={[{ value: "none", label: "off" }, ...TRANSCRIPTION_PROVIDER_OPTIONS]}
                  value={ai.transcriptionProvider ?? "none"}
                  onChange={(v) =>
                    ai.setTranscriptionProvider(v === "none" ? null : (v as TranscriptionProvider))
                  }
                  disabled={pending}
                />
              </div>
              {ai.transcriptionProvider && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>
                      api key
                      {ai.transcriptionProvider === ai.provider && (
                        <span className="text-muted-foreground ml-1">
                          (leave blank to reuse chat key)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={ai.transcriptionApiKey}
                      onChange={(e) => ai.setTranscriptionApiKey(e.target.value)}
                      placeholder="sk-..."
                      maxLength={SETTINGS_API_KEY_MAX_LENGTH}
                      disabled={pending}
                      className={INPUT}
                    />
                    <CharCount
                      length={ai.transcriptionApiKey.length}
                      max={SETTINGS_API_KEY_MAX_LENGTH}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>model</label>
                    <input
                      type="text"
                      value={ai.transcriptionModel}
                      onChange={(e) => ai.setTranscriptionModel(e.target.value)}
                      placeholder={TRANSCRIPTION_DEFAULT_MODELS[ai.transcriptionProvider]}
                      maxLength={AI_MODEL_MAX_LENGTH}
                      disabled={pending}
                      className={INPUT}
                    />
                    <CharCount length={ai.transcriptionModel.length} max={AI_MODEL_MAX_LENGTH} />
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
