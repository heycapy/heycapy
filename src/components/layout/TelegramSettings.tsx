"use client";

import { Toggle } from "@/components/ui/Toggle";
import { sendTestNotificationAction } from "@/app/(app)/actions";
import { BOX, LABEL, SECTION } from "./settings-constants";
import { TestSendButton } from "./TestSendButton";

interface TelegramSettingsProps {
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

export function TelegramSettings({
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
}: TelegramSettingsProps) {
  const telegramConnected = !!telegramChatId;

  return (
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
          <TestSendButton
            disabled={pending}
            onSend={() => sendTestNotificationAction("telegram")}
          />
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
              <span className="text-foreground/70">@{telegramBotUsername}</span> in Telegram — then
              click [recheck] to confirm
            </p>
          )}
          {telegramError && (
            <p className="text-destructive font-mono text-[9px]">{telegramError}</p>
          )}
        </>
      )}
    </div>
  );
}
