"use client";

import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { LABEL, INPUT, THEMES, TONE_OPTIONS, PROVIDER_OPTIONS } from "./settings-constants";
import type { UserTone, AIProvider } from "./settings-constants";

interface AppearanceTabProps {
  theme: string | undefined;
  setTheme: (t: string) => void;
}

export function AppearanceTab({ theme, setTheme }: AppearanceTabProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>theme</label>
      <div className="flex gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className="border-border h-10 w-full border-2 transition-all"
              style={{
                background: t.bg,
                borderColor: theme === t.id ? t.fg : undefined,
                boxShadow: theme === t.id ? `2px 2px 0 ${t.fg}` : undefined,
              }}
            />
            <span
              className={cn(
                "font-mono text-[10px]",
                theme === t.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface NotificationsTabProps {
  notificationsEmail: boolean;
  setNotificationsEmail: (v: boolean) => void;
  notificationsPush: boolean;
  setNotificationsPush: (v: boolean) => void;
  ntfyUrl: string;
  setNtfyUrl: (v: string) => void;
  ntfyTopic: string;
  setNtfyTopic: (v: string) => void;
  pending: boolean;
}

export function NotificationsTab({
  notificationsEmail,
  setNotificationsEmail,
  notificationsPush,
  setNotificationsPush,
  ntfyUrl,
  setNtfyUrl,
  ntfyTopic,
  setNtfyTopic,
  pending,
}: NotificationsTabProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>email notifications</label>
        <Toggle value={notificationsEmail} onChange={setNotificationsEmail} disabled={pending} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>push notifications</label>
        <Toggle value={notificationsPush} onChange={setNotificationsPush} disabled={pending} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>ntfy server url</label>
        <input
          type="text"
          value={ntfyUrl}
          onChange={(e) => setNtfyUrl(e.target.value)}
          placeholder="https://ntfy.sh"
          disabled={pending}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>ntfy topic</label>
        <input
          type="text"
          value={ntfyTopic}
          onChange={(e) => setNtfyTopic(e.target.value)}
          placeholder="my-topic"
          disabled={pending}
          className={INPUT}
        />
      </div>
    </>
  );
}

interface AITabProps {
  aiProvider: AIProvider;
  setAiProvider: (v: AIProvider) => void;
  aiApiKey: string;
  setAiApiKey: (v: string) => void;
  aiModel: string;
  setAiModel: (v: string) => void;
  aiOllamaUrl: string;
  setAiOllamaUrl: (v: string) => void;
  pending: boolean;
}

export function AITab({
  aiProvider,
  setAiProvider,
  aiApiKey,
  setAiApiKey,
  aiModel,
  setAiModel,
  aiOllamaUrl,
  setAiOllamaUrl,
  pending,
}: AITabProps) {
  return (
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
            placeholder="http://localhost:11434"
            disabled={pending}
            className={INPUT}
          />
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
            disabled={pending}
            className={INPUT}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>model</label>
        <input
          type="text"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
          placeholder={
            aiProvider === "ollama"
              ? "llama3.2"
              : aiProvider === "openai"
                ? "gpt-4o"
                : "claude-sonnet-4-6"
          }
          disabled={pending}
          className={INPUT}
        />
      </div>
    </>
  );
}

interface PersonalityTabProps {
  personalityName: string;
  setPersonalityName: (v: string) => void;
  personalityTone: UserTone;
  setPersonalityTone: (v: UserTone) => void;
  personalityCustomPrompt: string;
  setPersonalityCustomPrompt: (v: string) => void;
  personalityEmoji: boolean;
  setPersonalityEmoji: (v: boolean) => void;
  pending: boolean;
}

export function PersonalityTab({
  personalityName,
  setPersonalityName,
  personalityTone,
  setPersonalityTone,
  personalityCustomPrompt,
  setPersonalityCustomPrompt,
  personalityEmoji,
  setPersonalityEmoji,
  pending,
}: PersonalityTabProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>name</label>
        <input
          type="text"
          value={personalityName}
          onChange={(e) => setPersonalityName(e.target.value)}
          placeholder="Capy"
          disabled={pending}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>tone</label>
        <OptionGroup
          options={TONE_OPTIONS}
          value={personalityTone}
          onChange={setPersonalityTone}
          disabled={pending}
        />
      </div>
      {personalityTone === "custom" && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>custom prompt</label>
          <textarea
            value={personalityCustomPrompt}
            onChange={(e) => setPersonalityCustomPrompt(e.target.value)}
            placeholder="Describe the tone and style..."
            disabled={pending}
            rows={4}
            className="border-border placeholder:text-muted-foreground/50 focus:border-foreground w-full resize-none border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50"
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>use emoji</label>
        <Toggle value={personalityEmoji} onChange={setPersonalityEmoji} disabled={pending} />
      </div>
    </>
  );
}
