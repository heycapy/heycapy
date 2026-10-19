import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { QRCodeSVG } from "qrcode.react";
import { Toggle } from "@/components/ui/Toggle";
import { createTelegramLinkAction, sendTestNotificationAction } from "@/app/(app)/actions";
import { BOX, INPUT, LABEL, SECTION, TELEGRAM_QR_SIZE, HINT } from "./settings-constants";
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
        <p className={HINT}>
          set <code className="font-mono">TELEGRAM_BOT_TOKEN</code> in .env to enable telegram
        </p>
      ) : telegramConnected ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className={LABEL}>status</span>
              <span className={HINT}>connected · chat id: {telegramChatId}</span>
            </div>
            <BracketButton
              type="button"
              onClick={() => void onDisconnectTelegram()}
              disabled={telegramActionPending || pending}
              className="text-[11px]"
            >
              disconnect
            </BracketButton>
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
              <span className={HINT}>not connected</span>
            </div>
            <div className="flex items-center gap-2">
              <BracketButton
                type="button"
                onClick={() => void onRecheckTelegram()}
                disabled={telegramActionPending || pending}
                className="text-[11px]"
              >
                recheck
              </BracketButton>
              <BracketButton
                type="button"
                onClick={handleConnect}
                disabled={connecting || telegramActionPending || pending}
                className="text-[11px]"
              >
                {connecting ? "connecting..." : "connect"}
              </BracketButton>
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
                <BracketButton
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 text-[11px]"
                >
                  {copyState === "copied" ? "copied" : "copy"}
                </BracketButton>
              </div>
              <QRCodeSVG
                value={link}
                size={TELEGRAM_QR_SIZE}
                marginSize={4}
                title="scan to connect telegram"
                role="img"
                className="self-start"
              />
              <p className={HINT}>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:text-foreground underline"
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
