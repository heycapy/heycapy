import { useState } from "react";
import { SidePanel } from "@/components/ui/SidePanel";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
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
      <SidePanel
        open={open}
        onClose={onClose}
        title="bucket settings"
        context={bucket.name}
        narrow="sheet"
        className={ACCENT_BUTTONS}
      >
        <BucketSettingsForm
          bucket={bucket}
          clocksDiffer={clocksDiffer}
          onClose={onClose}
          initialTab={initialTab}
          onOpenSchema={() => setSchemaOpen(true)}
          onOpenTelegram={() => setTelegramOpen(true)}
          onOpenWebhook={() => setWebhookOpen(true)}
        />
      </SidePanel>
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
