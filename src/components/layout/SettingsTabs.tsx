"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import {
  LABEL,
  INPUT,
  THEMES,
  TONE_OPTIONS,
  PROVIDER_OPTIONS,
  PROVIDER_DEFAULT_MODELS,
  TRANSCRIPTION_PROVIDER_OPTIONS,
  TRANSCRIPTION_DEFAULT_MODELS,
} from "./settings-constants";
import type { UserTone, AIProvider, TranscriptionProvider } from "./settings-constants";
import { OLLAMA_DEFAULT_URL, NTFY_DEFAULT_URL } from "@/constants";

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
  notificationsTelegram: boolean;
  setNotificationsTelegram: (v: boolean) => void;
  telegramBotToken: string;
  setTelegramBotToken: (v: string) => void;
  telegramChatId: string;
  setTelegramChatId: (v: string) => void;
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
  notificationsTelegram,
  setNotificationsTelegram,
  telegramBotToken,
  setTelegramBotToken,
  telegramChatId,
  setTelegramChatId,
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
            placeholder={NTFY_DEFAULT_URL}
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

      <div className="border-border flex flex-col gap-3 border-t pt-3">
        <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-widest uppercase">
          telegram
        </span>
        <div className="flex items-center justify-between">
          <label className={LABEL}>enabled</label>
          <Toggle
            value={notificationsTelegram}
            onChange={setNotificationsTelegram}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>bot token</label>
          <input
            type="password"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="1234567890:ABC..."
            maxLength={200}
            disabled={pending}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>chat id</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="123456789"
            maxLength={50}
            disabled={pending}
            className={INPUT}
          />
        </div>
        <p className="text-muted-foreground font-mono text-[9px]">
          Get a bot token from @BotFather · Get your chat ID from @userinfobot
        </p>
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
  aiCompactThreshold: number;
  setAiCompactThreshold: (v: number) => void;
  transcriptionProvider: TranscriptionProvider | null;
  setTranscriptionProvider: (v: TranscriptionProvider | null) => void;
  transcriptionApiKey: string;
  setTranscriptionApiKey: (v: string) => void;
  transcriptionModel: string;
  setTranscriptionModel: (v: string) => void;
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
  aiCompactThreshold,
  setAiCompactThreshold,
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
      "font-mono text-[10px] px-2 py-0.5 transition-colors",
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
              placeholder={PROVIDER_DEFAULT_MODELS[aiProvider]}
              maxLength={100}
              disabled={pending}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>autocompact after</label>
            <input
              type="number"
              value={aiCompactThreshold}
              onChange={(e) => setAiCompactThreshold(Math.max(10, parseInt(e.target.value) || 40))}
              placeholder="40"
              min={10}
              max={500}
              disabled={pending}
              className={INPUT}
            />
            <span className="text-muted-foreground/50 font-mono text-[9px]">
              messages before compacting chat history — increase for more powerful models
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
                    <span className="text-muted-foreground/50 ml-1">
                      (leave blank to reuse chat key)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={transcriptionApiKey}
                  onChange={(e) => setTranscriptionApiKey(e.target.value)}
                  placeholder="sk-..."
                  maxLength={200}
                  disabled={pending}
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>model</label>
                <input
                  type="text"
                  value={transcriptionModel}
                  onChange={(e) => setTranscriptionModel(e.target.value)}
                  placeholder={TRANSCRIPTION_DEFAULT_MODELS[transcriptionProvider]}
                  maxLength={100}
                  disabled={pending}
                  className={INPUT}
                />
              </div>
            </>
          )}
        </>
      )}
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
