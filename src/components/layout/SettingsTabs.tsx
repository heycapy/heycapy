"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { LABEL, INPUT, THEMES, TONE_OPTIONS, PROVIDER_OPTIONS } from "./settings-constants";
import type { UserTone, AIProvider } from "./settings-constants";

interface AppearanceTabProps {
  theme: string | undefined;
  setTheme: (t: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  pending: boolean;
}

export function AppearanceTab({
  theme,
  setTheme,
  timezone,
  setTimezone,
  pending,
}: AppearanceTabProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>theme</label>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className="border-border h-8 w-full border-2 transition-all"
                style={{
                  background: t.bg,
                  borderColor: theme === t.id ? t.fg : undefined,
                  boxShadow: theme === t.id ? `2px 2px 0 ${t.fg}` : undefined,
                }}
              />
              <span
                className={cn(
                  "text-center font-mono text-[10px] leading-tight",
                  theme === t.id ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/New_York"
          maxLength={50}
          disabled={pending}
          className={INPUT}
        />
      </div>
    </>
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
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!ntfyTopic) return;
    void navigator.clipboard.writeText(ntfyTopic).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-widest uppercase">
          email
        </span>
        <div className="flex items-center justify-between">
          <label className={LABEL}>enabled</label>
          <Toggle value={notificationsEmail} onChange={setNotificationsEmail} disabled={pending} />
        </div>
      </div>

      <div className="border-border flex flex-col gap-3 border-t pt-3">
        <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-widest uppercase">
          ntfy (push)
        </span>
        <div className="flex items-center justify-between">
          <label className={LABEL}>enabled</label>
          <Toggle value={notificationsPush} onChange={setNotificationsPush} disabled={pending} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>server url</label>
          <input
            type="text"
            value={ntfyUrl}
            onChange={(e) => setNtfyUrl(e.target.value)}
            placeholder="https://ntfy.sh"
            maxLength={200}
            disabled={pending}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className={LABEL}>topic</label>
            <div className="flex items-center gap-2">
              {ntfyTopic && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground font-mono text-[9px]"
                >
                  {copied ? "copied!" : "copy"}
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setNtfyTopic(
                    `heycapy-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
                  )
                }
                className="text-muted-foreground hover:text-foreground font-mono text-[9px] disabled:opacity-50"
              >
                generate
              </button>
            </div>
          </div>
          <input
            type="text"
            value={ntfyTopic}
            onChange={(e) => setNtfyTopic(e.target.value)}
            placeholder="heycapy-k3m9xp2qlr7a"
            maxLength={100}
            disabled={pending}
            className={INPUT}
          />
        </div>
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
            maxLength={200}
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
            maxLength={200}
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
          maxLength={100}
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
          maxLength={50}
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
            maxLength={1000}
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
