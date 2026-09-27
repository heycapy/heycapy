"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { BracketButton } from "@/components/ui/BracketButton";
import { BucketRulesPanel } from "./BucketRulesPanel";
import type { NotifAvailability } from "./BucketRulesPanel";
import { parseBucketSettings, type BucketSettingsValues } from "./parseBucketSettings";
import { parseDurationToMins, parseDurationToDays } from "@/lib/duration";
import {
  updateBucketSettingsAction,
  archiveBucketAction,
  deleteBucketAction,
  getNotifAvailabilityAction,
} from "@/app/(app)/actions";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
export type SettingsTab = "items" | "notifications" | "advanced";

const TABS: SettingsTab[] = ["items", "notifications", "advanced"];

const tabCn = (active: boolean) =>
  `font-mono text-[10px] px-2 py-1 transition-colors shrink-0 whitespace-nowrap ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;

interface BucketSettingsFormProps {
  bucket: BucketRow;
  onClose: () => void;
  onOpenSchema: () => void;
  onOpenTelegram: () => void;
  onOpenWebhook: () => void;
  initialTab?: SettingsTab;
}

// Mounted fresh on every open, so the form always starts from the saved settings
export function BucketSettingsForm({
  bucket,
  onClose,
  onOpenSchema,
  onOpenTelegram,
  onOpenWebhook,
  initialTab = "items",
}: BucketSettingsFormProps) {
  const router = useRouter();
  const nameId = useId();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [values, setValues] = useState<BucketSettingsValues>(() => parseBucketSettings(bucket));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifAvailability, setNotifAvailability] = useState<NotifAvailability>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getNotifAvailabilityAction().then((result) => {
      if (!cancelled) setNotifAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof BucketSettingsValues>(key: K, value: BucketSettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await updateBucketSettingsAction(
        bucket.id,
        values.name,
        {
          sortBy: values.sortBy,
          drag: values.drag,
          readonly: values.readonly,
          showCompleted: values.showCompleted,
          defaultDeadlineOffsetDays: parseDurationToDays(values.defaultDeadlineOffset),
        },
        {
          medium: values.mediums,
          notifyAt: values.notifyAt || undefined,
          defaultOffsetMins: parseDurationToMins(values.defaultOffset) ?? undefined,
          repeat: values.repeat,
        },
        undefined,
        {
          notifyOnArrival: values.notifyOnArrival,
          notifyWhenOverdue: values.notifyWhenOverdue,
          overdueRepeatHours: values.overdueRepeatHours,
        }
      );
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  function handleArchive() {
    if (pending) return;
    startTransition(async () => {
      await archiveBucketAction(bucket.id);
      router.refresh();
      onClose();
    });
  }

  function handleDelete() {
    if (pending) return;
    startTransition(async () => {
      await deleteBucketAction(bucket.id);
      router.refresh();
      onClose();
    });
  }

  const showSave = tab === "items" || tab === "notifications";

  return (
    <div className="border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2">
      <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <span className="font-pixel min-w-0 truncate text-xs">bucket settings [{bucket.name}]</span>
        <BracketButton variant="inverted" onClick={onClose}>
          x
        </BracketButton>
      </div>

      <div className="flex shrink-0 flex-col gap-4 px-4 pt-4 pb-0">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-muted-foreground font-mono text-[10px]">
            name
          </label>
          <input
            id={nameId}
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={BUCKET_NAME_MAX_LENGTH}
            disabled={pending}
            className="border-border focus:border-foreground w-full border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50"
          />
          {values.name.length > 0 && (
            <p
              className={cn(
                "text-right font-mono text-[9px] transition-colors",
                charCountColor(values.name.length, BUCKET_NAME_MAX_LENGTH)
              )}
            >
              {values.name.length}/{BUCKET_NAME_MAX_LENGTH}
            </p>
          )}
          {error && <span className="text-destructive font-mono text-[10px]">{error}</span>}
        </div>
        <div className="border-border flex overflow-x-auto border-b">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={tabCn(tab === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {(tab === "items" || tab === "notifications") && (
          <BucketRulesPanel
            activeTab={tab}
            disabled={pending}
            sortBy={values.sortBy}
            drag={values.drag}
            showCompleted={values.showCompleted}
            readonly={values.readonly}
            defaultDeadlineOffset={values.defaultDeadlineOffset}
            mediums={values.mediums}
            notifyAt={values.notifyAt}
            defaultOffset={values.defaultOffset}
            repeat={values.repeat}
            notifyOnArrival={values.notifyOnArrival}
            notifyWhenOverdue={values.notifyWhenOverdue}
            overdueRepeatHours={values.overdueRepeatHours}
            onSortByChange={(v) => set("sortBy", v)}
            onDragChange={(v) => set("drag", v)}
            onShowCompletedChange={(v) => set("showCompleted", v)}
            onReadonlyChange={(v) => set("readonly", v)}
            onDefaultDeadlineOffsetChange={(v) => set("defaultDeadlineOffset", v)}
            onMediumToggle={(m) =>
              setValues((prev) => ({
                ...prev,
                mediums: prev.mediums.includes(m)
                  ? prev.mediums.filter((x) => x !== m)
                  : [...prev.mediums, m],
              }))
            }
            onNotifyAtChange={(v) => set("notifyAt", v)}
            onDefaultOffsetChange={(v) => set("defaultOffset", v)}
            onRepeatChange={(v) => set("repeat", v)}
            onNotifyOnArrivalChange={(v) => set("notifyOnArrival", v)}
            onNotifyWhenOverdueChange={(v) => set("notifyWhenOverdue", v)}
            onOverdueRepeatHoursChange={(v) => set("overdueRepeatHours", v)}
            notifAvailability={notifAvailability}
          />
        )}

        {tab === "notifications" && (
          <div className="border-border flex flex-col gap-1.5 border-t pt-4">
            <p className="text-muted-foreground font-mono text-[10px]">telegram bot</p>
            <p className="text-muted-foreground/50 font-mono text-[9px] leading-tight">
              set an alias shortcut, deadline buttons, time slots, and recurring options
            </p>
            <BracketButton onClick={onOpenTelegram} className="w-fit">
              configure telegram
            </BracketButton>
          </div>
        )}

        {tab === "advanced" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground font-mono text-[10px]">schema</p>
              <p className="text-muted-foreground/50 font-mono text-[9px] leading-tight">
                define custom fields and notification rules for this bucket
              </p>
              <BracketButton onClick={onOpenSchema} className="w-fit">
                configure schema
              </BracketButton>
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground font-mono text-[10px]">webhook</p>
              <p className="text-muted-foreground/50 font-mono text-[9px] leading-tight">
                receive items from external services via HTTP
              </p>
              <BracketButton onClick={onOpenWebhook} className="w-fit">
                configure webhook
              </BracketButton>
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground font-mono text-[10px]">danger zone</p>
              <p className="text-muted-foreground/50 font-mono text-[9px] leading-relaxed">
                archived and deleted buckets can be accessed via the header — use archive to hide a
                bucket, or delete to move it to trash.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <BracketButton variant="warning" onClick={handleArchive} disabled={pending}>
                  archive
                </BracketButton>
                {confirmDelete ? (
                  <>
                    <span className="text-destructive font-mono text-[10px]">sure?</span>
                    <BracketButton variant="destructive" onClick={handleDelete} disabled={pending}>
                      confirm
                    </BracketButton>
                    <BracketButton onClick={() => setConfirmDelete(false)} disabled={pending}>
                      cancel
                    </BracketButton>
                  </>
                ) : (
                  <BracketButton
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={pending}
                  >
                    delete
                  </BracketButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showSave && (
        <div className="border-border flex shrink-0 justify-end border-t px-3 py-2.5">
          <BracketButton onClick={handleSave} disabled={!values.name.trim() || pending}>
            save
          </BracketButton>
        </div>
      )}
    </div>
  );
}
