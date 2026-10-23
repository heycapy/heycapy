import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { BucketSettingsForm, type SettingsTab } from "./BucketSettingsForm";
import { SchemaEditorDialog } from "./SchemaEditorDialog";
import { TelegramConfigDialog } from "./TelegramConfigDialog";
import { WebhookDialog } from "./WebhookDialog";
import type { ViewerBucket } from "@/lib/buckets/access";

type BucketSettingsProps = {
  open: boolean;
  bucket: ViewerBucket;
  clocksDiffer: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
};

export function BucketSettings({
  open,
  bucket,
  clocksDiffer,
  onClose,
  initialTab,
}: BucketSettingsProps) {
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <BucketSettingsForm
          bucket={bucket}
          clocksDiffer={clocksDiffer}
          onClose={onClose}
          initialTab={initialTab}
          onOpenSchema={() => setSchemaOpen(true)}
          onOpenTelegram={() => setTelegramOpen(true)}
          onOpenWebhook={() => setWebhookOpen(true)}
        />
      </Modal>
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
