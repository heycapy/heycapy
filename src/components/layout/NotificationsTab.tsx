"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { LABEL, INPUT } from "./settings-constants";
import { NTFY_DEFAULT_URL, SETTINGS_URL_MAX_LENGTH, NTFY_TOPIC_MAX_LENGTH } from "@/constants";
import { SmtpTestDialog } from "./SmtpTestDialog";

interface NotificationsTabProps {
  notificationsEmail: boolean;
  setNotificationsEmail: (v: boolean) => void;
  notificationEmailTo: string;
  setNotificationEmailTo: (v: string) => void;
  userEmail: string;
  smtpHost: string;
  setSmtpHost: (v: string) => void;
  smtpPort: string;
  setSmtpPort: (v: string) => void;
  smtpUser: string;
  setSmtpUser: (v: string) => void;
  smtpPass: string;
  setSmtpPass: (v: string) => void;
  smtpPassSaved: boolean;
  smtpSecure: boolean;
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

const SECTION =
  "text-muted-foreground font-mono text-[10px] font-semibold tracking-widest uppercase";
const BOX = "border-border flex flex-col gap-3 border p-3";

export function NotificationsTab({
  notificationsEmail,
  setNotificationsEmail,
  notificationEmailTo,
  setNotificationEmailTo,
  userEmail,
  smtpHost,
  setSmtpHost,
  smtpPort,
  setSmtpPort,
  smtpUser,
  setSmtpUser,
  smtpPass,
  setSmtpPass,
  smtpPassSaved,
  smtpSecure,
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
  const [ntfyCopied, setNtfyCopied] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [smtpPassFocused, setSmtpPassFocused] = useState(false);

  function handleCopyNtfy() {
    if (!ntfyTopic) return;
    void navigator.clipboard.writeText(ntfyTopic).then(() => {
      setNtfyCopied(true);
      setTimeout(() => setNtfyCopied(false), 1500);
    });
  }

  const telegramConnected = !!telegramChatId;
  const effectiveDeliverTo = notificationEmailTo || userEmail;

  return (
    <div className="flex flex-col gap-3">
      <div className={BOX}>
        <span className={SECTION}>email</span>

        <div className="flex items-center justify-between">
          <label className={LABEL}>enabled</label>
          <Toggle value={notificationsEmail} onChange={setNotificationsEmail} disabled={pending} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>host</label>
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              disabled={pending}
              className={INPUT}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex w-24 shrink-0 flex-col gap-1.5">
              <label className={LABEL}>port</label>
              <input
                type="text"
                inputMode="numeric"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                disabled={pending}
                className={INPUT}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className={LABEL}>send from</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="you@gmail.com"
                disabled={pending}
                className={INPUT}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-muted-foreground/60 -mt-1 font-mono text-[9px]">
            port 587 = standard (gmail) · port 465 = ssl
          </p>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>app password</label>
            <input
              type="password"
              value={smtpPassSaved && !smtpPass && !smtpPassFocused ? "••••••••" : smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              onFocus={() => {
                setSmtpPassFocused(true);
                if (smtpPassSaved && !smtpPass) setSmtpPass("");
              }}
              onBlur={() => setSmtpPassFocused(false)}
              placeholder="app password"
              disabled={pending}
              className={INPUT}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>deliver to</label>
          <input
            type="text"
            value={notificationEmailTo}
            onChange={(e) => setNotificationEmailTo(e.target.value)}
            placeholder={userEmail}
            disabled={pending}
            className={INPUT}
          />
          <p className="text-muted-foreground/60 font-mono text-[9px]">
            where notifications are sent · defaults to your account email
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTestDialogOpen(true)}
          disabled={pending || !smtpHost}
          className="text-muted-foreground hover:text-foreground self-start font-mono text-[10px] disabled:opacity-40"
        >
          [send test email]
        </button>
      </div>

      <div className={BOX}>
        <span className={SECTION}>ntfy (push)</span>
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
                  onClick={handleCopyNtfy}
                  className="text-muted-foreground hover:text-foreground font-mono text-[9px]"
                >
                  {ntfyCopied ? "copied!" : "copy"}
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

      <div className={BOX}>
        <span className={SECTION}>telegram</span>

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

      <SmtpTestDialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        from={smtpUser}
        defaultTo={effectiveDeliverTo}
        smtpHost={smtpHost}
        smtpPort={smtpPort}
        smtpUser={smtpUser}
        smtpPass={smtpPass || null}
        smtpSecure={smtpSecure}
      />
    </div>
  );
}
