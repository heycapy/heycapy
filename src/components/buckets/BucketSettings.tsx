"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
import { BucketSettingsForm } from "./BucketSettingsForm";
import { SchemaEditorDialog } from "./SchemaEditorDialog";
import { TelegramConfigDialog } from "./TelegramConfigDialog";
import { WebhookDialog } from "./WebhookDialog";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

interface BucketSettingsProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

export function BucketSettings({ open, bucket, onClose }: BucketSettingsProps) {
  useScrollLock(open);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 z-[55] bg-black"
              onClick={onClose}
            />
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed top-[8%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:top-[12%]"
              style={{ boxShadow: "5px 5px 0 var(--border)" }}
            >
              <BucketSettingsForm
                bucket={bucket}
                onClose={onClose}
                onOpenSchema={() => setSchemaOpen(true)}
                onOpenTelegram={() => setTelegramOpen(true)}
                onOpenWebhook={() => setWebhookOpen(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SchemaEditorDialog open={schemaOpen} bucket={bucket} onClose={() => setSchemaOpen(false)} />
      <TelegramConfigDialog
        open={telegramOpen}
        bucket={bucket}
        onClose={() => setTelegramOpen(false)}
      />
      <WebhookDialog open={webhookOpen} bucket={bucket} onClose={() => setWebhookOpen(false)} />
    </>
  );
}
