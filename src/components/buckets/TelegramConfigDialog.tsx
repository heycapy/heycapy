import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { TelegramConfigPanel } from "./TelegramConfigPanel";
import { updateBucketTelegramConfigAction } from "@/app/(app)/actions";
import type { TelegramBotConfig } from "./constants";
import { DEFAULT_TELEGRAM_BOT_CONFIG } from "./constants";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type TelegramConfigDialogProps = {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
};

function parseTelegramConfig(raw: string | null): TelegramBotConfig {
  if (!raw) return DEFAULT_TELEGRAM_BOT_CONFIG;
  try {
    const merged = {
      ...DEFAULT_TELEGRAM_BOT_CONFIG,
      ...(JSON.parse(raw) as Partial<TelegramBotConfig>),
    };
    merged.timeSlots = (merged.timeSlots as (string | number)[]).map((s) =>
      typeof s === "number" ? `${String(s).padStart(2, "0")}:00` : s
    );
    return merged;
  } catch {
    return DEFAULT_TELEGRAM_BOT_CONFIG;
  }
}

export function TelegramConfigDialog({ open, bucket, onClose }: TelegramConfigDialogProps) {
  return (
    <Modal open={open} onClose={onClose} layer="raised">
      <TelegramConfigForm bucket={bucket} onClose={onClose} />
    </Modal>
  );
}

// Mounted fresh on every open, so its state starts from the saved config with no reset effect
function TelegramConfigForm({ bucket, onClose }: Omit<TelegramConfigDialogProps, "open">) {
  const [config, setConfig] = useState(() => parseTelegramConfig(bucket.telegramConfig));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSave() {
    if (pending) return;
    startTransition(async () => {
      const result = await updateBucketTelegramConfigAction(bucket.id, config);
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <div
      className={cn(
        "border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2",
        ACCENT_BUTTONS
      )}
    >
      <ModalHeader title={`telegram config [${bucket.name}]`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TelegramConfigPanel config={config} onChange={setConfig} disabled={pending} />
      </div>
      {error && (
        <div className="border-border shrink-0 border-t px-4 py-2">
          <span className="text-destructive font-mono text-xs">{error}</span>
        </div>
      )}
      <div className="border-border flex shrink-0 justify-end border-t px-3 py-2.5">
        <BracketButton onClick={handleSave} disabled={pending}>
          save
        </BracketButton>
      </div>
    </div>
  );
}
