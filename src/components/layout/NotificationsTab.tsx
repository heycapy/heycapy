import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { LABEL, INPUT, SECTION, BOX } from "./settings-constants";
import { NtfySettings } from "./NtfySettings";
import { PushSettings } from "./PushSettings";
import { QuietHoursSettings } from "./QuietHoursSettings";
import { TelegramSettings } from "./TelegramSettings";
import { SmtpTestDialog } from "./SmtpTestDialog";

type NotificationsTabProps = {
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
  telegramBotConfigured: boolean;
  onDisconnectTelegram: () => Promise<void>;
  onRecheckTelegram: () => Promise<void>;
  telegramActionPending: boolean;
  pending: boolean;
};

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
  telegramBotConfigured,
  onDisconnectTelegram,
  onRecheckTelegram,
  telegramActionPending,
  pending,
}: NotificationsTabProps) {
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [smtpPassFocused, setSmtpPassFocused] = useState(false);

  const effectiveDeliverTo = notificationEmailTo || userEmail;

  return (
    <div className="flex flex-col gap-3">
      <QuietHoursSettings />
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
          <p className="text-muted-foreground -mt-1 font-mono text-[11px]">
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
          <p className="text-muted-foreground font-mono text-[11px]">
            where notifications are sent · defaults to your account email
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTestDialogOpen(true)}
          disabled={pending || !smtpHost}
          className="text-muted-foreground hover:text-foreground self-start font-mono text-xs disabled:opacity-40"
        >
          [send test email]
        </button>
      </div>

      <PushSettings pending={pending} />
      <NtfySettings
        notificationsPush={notificationsPush}
        setNotificationsPush={setNotificationsPush}
        ntfyUrl={ntfyUrl}
        setNtfyUrl={setNtfyUrl}
        ntfyTopic={ntfyTopic}
        setNtfyTopic={setNtfyTopic}
        pending={pending}
      />
      <TelegramSettings
        notificationsTelegram={notificationsTelegram}
        setNotificationsTelegram={setNotificationsTelegram}
        telegramChatId={telegramChatId}
        telegramBotConfigured={telegramBotConfigured}
        onDisconnectTelegram={onDisconnectTelegram}
        onRecheckTelegram={onRecheckTelegram}
        telegramActionPending={telegramActionPending}
        pending={pending}
      />
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
