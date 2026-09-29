import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[65] bg-black"
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[8%] left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:top-[12%]"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <TelegramConfigForm bucket={bucket} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
    <div className="border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2">
      <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <span className="font-pixel min-w-0 truncate text-xs">telegram config [{bucket.name}]</span>
        <BracketButton variant="inverted" onClick={onClose}>
          x
        </BracketButton>
      </div>
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
