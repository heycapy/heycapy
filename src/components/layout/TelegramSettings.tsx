import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Toggle } from "@/components/ui/Toggle";
import { createTelegramLinkAction, sendTestNotificationAction } from "@/app/(app)/actions";
import { BOX, INPUT, LABEL, SECTION, TELEGRAM_QR_SIZE } from "./settings-constants";
import { TestSendButton } from "./TestSendButton";

type TelegramSettingsProps = {
  notificationsTelegram: boolean;
  setNotificationsTelegram: (v: boolean) => void;
  telegramChatId: string | null;
  telegramBotConfigured: boolean;
  onDisconnectTelegram: () => Promise<void>;
  onRecheckTelegram: () => Promise<void>;
  telegramActionPending: boolean;
  pending: boolean;
};

export function TelegramSettings({
  notificationsTelegram,
  setNotificationsTelegram,
  telegramChatId,
  telegramBotConfigured,
  onDisconnectTelegram,
  onRecheckTelegram,
  telegramActionPending,
  pending,
}: TelegramSettingsProps) {
  const telegramConnected = !!telegramChatId;
  const [link, setLink] = useState<string | null>(null);
  const [connectError, setConnectError] = useState("");
  const [connecting, startConnecting] = useTransition();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  function handleCopyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1500);
      },
      () => setCopyState("failed")
    );
  }

  function handleConnect() {
    setConnectError("");
    startConnecting(async () => {
      const result = await createTelegramLinkAction();
      if (!result.ok) {
        setConnectError(result.error);
        return;
      }
      setLink(result.url);
      setCopyState("idle");
    });
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>telegram</span>

      {!telegramBotConfigured ? (
        <p className="text-muted-foreground font-mono text-[11px]">
          set <code className="font-mono">TELEGRAM_BOT_TOKEN</code> in .env to enable telegram
        </p>
      ) : telegramConnected ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className={LABEL}>status</span>
              <span className="text-muted-foreground font-mono text-[11px]">
                connected · chat id: {telegramChatId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void onDisconnectTelegram()}
              disabled={telegramActionPending || pending}
              className="text-muted-foreground hover:text-foreground font-mono text-[11px] disabled:opacity-40"
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
              <span className="text-muted-foreground font-mono text-[11px]">not connected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onRecheckTelegram()}
                disabled={telegramActionPending || pending}
                className="text-muted-foreground hover:text-foreground font-mono text-[11px] disabled:opacity-40"
              >
                [recheck]
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || telegramActionPending || pending}
                className="text-muted-foreground hover:text-foreground font-mono text-[11px] disabled:opacity-40"
              >
                {connecting ? "[connecting...]" : "[connect]"}
              </button>
            </div>
          </div>
          {link && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  aria-label="telegram connect link"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-[11px]"
                >
                  {copyState === "copied" ? "[copied]" : "[copy]"}
                </button>
              </div>
              <QRCodeSVG
                value={link}
                size={TELEGRAM_QR_SIZE}
                marginSize={4}
                title="scan to connect telegram"
                role="img"
                className="self-start"
              />
              <p className="text-muted-foreground font-mono text-[11px]">
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground/80 hover:text-foreground underline"
                >
                  open in telegram
                </a>{" "}
                scan it with your phone, or copy it — works once, expires in 15 minutes. then click
                [recheck]
              </p>
              {copyState === "failed" && (
                <p className="text-destructive font-mono text-[11px]">
                  couldn&apos;t copy — select the link and copy it
                </p>
              )}
            </div>
          )}
          {connectError && <p className="text-destructive font-mono text-[11px]">{connectError}</p>}
        </>
      )}
    </div>
  );
}
