"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { LABEL, INPUT } from "./settings-constants";
import { NTFY_DEFAULT_URL, SETTINGS_URL_MAX_LENGTH, NTFY_TOPIC_MAX_LENGTH } from "@/constants";

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
  telegramChatId: string | null;
  telegramBotUsername: string | null;
  telegramBotConfigured: boolean;
  onSetupTelegram: () => Promise<void>;
  onDisconnectTelegram: () => Promise<void>;
  onRecheckTelegram: () => Promise<void>;
  telegramActionPending: boolean;
  telegramError: string;
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
  telegramChatId,
  telegramBotUsername,
  telegramBotConfigured,
  onSetupTelegram,
  onDisconnectTelegram,
  onRecheckTelegram,
  telegramActionPending,
  telegramError,
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

  const telegramConnected = !!telegramChatId;

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
            maxLength={SETTINGS_URL_MAX_LENGTH}
            disabled={pending}
            className={INPUT}
          />
          {ntfyUrl.length > 0 && (
            <p
              className={cn(
                "mt-0.5 text-right font-mono text-[9px] transition-colors",
                charCountColor(ntfyUrl.length, SETTINGS_URL_MAX_LENGTH)
              )}
            >
              {ntfyUrl.length}/{SETTINGS_URL_MAX_LENGTH}
            </p>
          )}
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
            maxLength={NTFY_TOPIC_MAX_LENGTH}
            disabled={pending}
            className={INPUT}
          />
          {ntfyTopic.length > 0 && (
            <p
              className={cn(
                "mt-0.5 text-right font-mono text-[9px] transition-colors",
                charCountColor(ntfyTopic.length, NTFY_TOPIC_MAX_LENGTH)
              )}
            >
              {ntfyTopic.length}/{NTFY_TOPIC_MAX_LENGTH}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-widest uppercase">
          telegram
        </span>

        {!telegramBotConfigured ? (
          <p className="text-muted-foreground/60 font-mono text-[9px]">
            set <code className="font-mono">TELEGRAM_BOT_TOKEN</code> in .env to enable telegram
          </p>
        ) : telegramConnected ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className={LABEL}>status</span>
                <span className="text-muted-foreground/60 font-mono text-[9px]">
                  connected · chat id: {telegramChatId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onDisconnectTelegram()}
                disabled={telegramActionPending || pending}
                className="text-muted-foreground hover:text-foreground font-mono text-[9px] disabled:opacity-40"
              >
                [disconnect]
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className={LABEL}>notifications enabled</label>
              <Toggle
                value={notificationsTelegram}
                onChange={setNotificationsTelegram}
                disabled={pending}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className={LABEL}>status</span>
                <span className="text-muted-foreground/60 font-mono text-[9px]">not connected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onRecheckTelegram()}
                  disabled={telegramActionPending || pending}
                  className="text-muted-foreground hover:text-foreground font-mono text-[9px] disabled:opacity-40"
                >
                  [recheck]
                </button>
                <button
                  type="button"
                  onClick={() => void onSetupTelegram()}
                  disabled={telegramActionPending || pending}
                  className="text-muted-foreground hover:text-foreground font-mono text-[9px] disabled:opacity-40"
                >
                  {telegramActionPending ? "[connecting...]" : "[connect]"}
                </button>
              </div>
            </div>
            {telegramBotUsername && (
              <p className="text-muted-foreground/60 font-mono text-[9px]">
                send <code className="font-mono">/start</code> to{" "}
                <span className="text-foreground/70">@{telegramBotUsername}</span> in Telegram —
                then click [recheck] to confirm
              </p>
            )}
            {telegramError && (
              <p className="text-destructive font-mono text-[9px]">{telegramError}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
