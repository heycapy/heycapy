import { useState } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { Toggle } from "@/components/ui/Toggle";
import { NTFY_DEFAULT_URL, SETTINGS_URL_MAX_LENGTH, NTFY_TOPIC_MAX_LENGTH } from "@/constants";
import { sendTestNotificationAction } from "@/app/(app)/actions";
import { BOX, INPUT, LABEL, SECTION } from "./settings-constants";
import { TestSendButton } from "./TestSendButton";

type NtfySettingsProps = {
  notificationsPush: boolean;
  setNotificationsPush: (v: boolean) => void;
  ntfyUrl: string;
  setNtfyUrl: (v: string) => void;
  ntfyTopic: string;
  setNtfyTopic: (v: string) => void;
  pending: boolean;
};

export function NtfySettings({
  notificationsPush,
  setNotificationsPush,
  ntfyUrl,
  setNtfyUrl,
  ntfyTopic,
  setNtfyTopic,
  pending,
}: NtfySettingsProps) {
  const [ntfyCopied, setNtfyCopied] = useState(false);

  function handleCopyNtfy() {
    if (!ntfyTopic) return;
    void navigator.clipboard.writeText(ntfyTopic).then(() => {
      setNtfyCopied(true);
      setTimeout(() => setNtfyCopied(false), 1500);
    });
  }

  return (
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
      <TestSendButton
        disabled={pending || !ntfyUrl.trim() || !ntfyTopic.trim()}
        onSend={() => sendTestNotificationAction("ntfy", { url: ntfyUrl, topic: ntfyTopic })}
      />
    </div>
  );
}
