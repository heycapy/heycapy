"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { BucketRulesPanel } from "./BucketRulesPanel";
import { SchemaEditorDialog } from "./SchemaEditorDialog";
import { WebhookPanel } from "./WebhookPanel";
import type { SortBy, NotificationMedium, RepeatMode } from "./constants";
import {
  parseDurationToMins,
  minsToDisplayStr,
  parseDurationToDays,
  daysToDisplayStr,
} from "@/lib/duration";
import {
  updateBucketSettingsAction,
  archiveBucketAction,
  deleteBucketAction,
} from "@/app/(app)/actions";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
type Tab = "items" | "notifications" | "schema" | "webhook" | "danger";

type RawItemsRules = {
  sortBy?: string;
  sort_by?: string;
  drag?: boolean;
  readonly?: boolean;
  showCompleted?: boolean;
  show_completed?: boolean;
  defaultDeadlineOffsetDays?: number | null;
  default_deadline_offset?: string | null;
};

type RawNotifRules = {
  medium?: NotificationMedium[];
  notifyAt?: string;
  notify_at?: string;
  defaultOffsetMins?: number;
  default_offset?: string;
  repeat?: RepeatMode;
  quietHours?: { from: string; to: string } | null;
  quiet_hours?: { from: string; to: string } | null;
};

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

const tabCn = (active: boolean) =>
  `font-mono text-[10px] px-2 py-1 transition-colors ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;

interface BucketSettingsProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

export function BucketSettings({ open, bucket, onClose }: BucketSettingsProps) {
  const router = useRouter();
  useScrollLock(open);
  const [tab, setTab] = useState<Tab>("items");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [name, setName] = useState(bucket.name);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [drag, setDrag] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const [defaultDeadlineOffset, setDefaultDeadlineOffset] = useState("");
  const [mediums, setMediums] = useState<NotificationMedium[]>([]);
  const [notifyAt, setNotifyAt] = useState("");
  const [defaultOffset, setDefaultOffset] = useState("");
  const [repeat, setRepeat] = useState<RepeatMode>("once");

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setConfirmDelete(false);
      setName(bucket.name);
      setError("");
      setTab("items");
      const ir = parseJson<RawItemsRules>(bucket.itemsRules, {});
      setSortBy(((ir.sortBy ?? ir.sort_by) as SortBy | undefined) ?? "created_at");
      setDrag(ir.drag ?? false);
      setShowCompleted((ir.showCompleted ?? ir.show_completed) !== false);
      setReadonly(ir.readonly ?? false);
      setDefaultDeadlineOffset(
        ir.defaultDeadlineOffsetDays !== null && ir.defaultDeadlineOffsetDays !== undefined
          ? daysToDisplayStr(ir.defaultDeadlineOffsetDays)
          : (ir.default_deadline_offset ?? "")
      );
      const nr = parseJson<RawNotifRules>(bucket.notificationsRules, {});
      setMediums(nr.medium ?? []);
      setNotifyAt(nr.notifyAt ?? nr.notify_at ?? "");
      setDefaultOffset(
        nr.defaultOffsetMins !== undefined && nr.defaultOffsetMins !== null
          ? minsToDisplayStr(nr.defaultOffsetMins)
          : (nr.default_offset ?? "")
      );
      setRepeat(nr.repeat ?? "once");
    }, 0);
    return () => clearTimeout(id);
  }, [open, bucket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const result = await updateBucketSettingsAction(
        bucket.id,
        name,
        {
          sortBy,
          drag,
          readonly,
          showCompleted,
          defaultDeadlineOffsetDays: parseDurationToDays(defaultDeadlineOffset),
        },
        {
          medium: mediums,
          notifyAt: notifyAt || undefined,
          defaultOffsetMins: parseDurationToMins(defaultOffset) ?? undefined,
          repeat,
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
              <div className="border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2">
                <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
                  <span className="font-pixel min-w-0 truncate text-xs">
                    bucket settings [{bucket.name}]
                  </span>
                  <BracketButton variant="inverted" onClick={onClose}>
                    x
                  </BracketButton>
                </div>

                <div className="flex shrink-0 flex-col gap-4 px-4 pt-4 pb-0">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted-foreground font-mono text-[10px]">name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={BUCKET_NAME_MAX_LENGTH}
                      disabled={pending}
                      className="border-border focus:border-foreground w-full border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50"
                    />
                    {name.length > 0 && (
                      <p
                        className={cn(
                          "text-right font-mono text-[9px] transition-colors",
                          charCountColor(name.length, BUCKET_NAME_MAX_LENGTH)
                        )}
                      >
                        {name.length}/{BUCKET_NAME_MAX_LENGTH}
                      </p>
                    )}
                    {error && (
                      <span className="text-destructive font-mono text-[10px]">{error}</span>
                    )}
                  </div>
                  <div className="border-border flex border-b">
                    {(["items", "notifications", "schema", "webhook", "danger"] as Tab[]).map(
                      (t) => (
                        <button key={t} onClick={() => setTab(t)} className={tabCn(tab === t)}>
                          {t}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  {(tab === "items" || tab === "notifications") && (
                    <BucketRulesPanel
                      activeTab={tab}
                      disabled={pending}
                      sortBy={sortBy}
                      drag={drag}
                      showCompleted={showCompleted}
                      readonly={readonly}
                      defaultDeadlineOffset={defaultDeadlineOffset}
                      mediums={mediums}
                      notifyAt={notifyAt}
                      defaultOffset={defaultOffset}
                      repeat={repeat}
                      onSortByChange={setSortBy}
                      onDragChange={setDrag}
                      onShowCompletedChange={setShowCompleted}
                      onReadonlyChange={setReadonly}
                      onDefaultDeadlineOffsetChange={setDefaultDeadlineOffset}
                      onMediumToggle={(m) =>
                        setMediums((prev) =>
                          prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                        )
                      }
                      onNotifyAtChange={setNotifyAt}
                      onDefaultOffsetChange={setDefaultOffset}
                      onRepeatChange={setRepeat}
                    />
                  )}
                  {tab === "schema" && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-muted-foreground/50 font-mono text-[9px] leading-tight">
                        define custom fields, statuses, and notification rules for this bucket
                      </p>
                      <BracketButton onClick={() => setSchemaOpen(true)} className="w-fit">
                        configure schema
                      </BracketButton>
                    </div>
                  )}
                  {tab === "webhook" && <WebhookPanel bucket={bucket} />}
                  {tab === "danger" && (
                    <div className="flex flex-col gap-3">
                      <p className="text-muted-foreground/50 font-mono text-[9px] leading-relaxed">
                        archived and deleted buckets can be accessed via the header — use archive to
                        hide a bucket, or delete to move it to trash.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <BracketButton variant="warning" onClick={handleArchive} disabled={pending}>
                          archive
                        </BracketButton>
                        {confirmDelete ? (
                          <>
                            <span className="text-destructive font-mono text-[10px]">sure?</span>
                            <BracketButton
                              variant="destructive"
                              onClick={handleDelete}
                              disabled={pending}
                            >
                              confirm
                            </BracketButton>
                            <BracketButton
                              onClick={() => setConfirmDelete(false)}
                              disabled={pending}
                            >
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
                  )}
                </div>

                {showSave && (
                  <div className="border-border flex shrink-0 justify-end border-t px-3 py-2.5">
                    <BracketButton onClick={handleSave} disabled={!name.trim() || pending}>
                      save
                    </BracketButton>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <SchemaEditorDialog open={schemaOpen} bucket={bucket} onClose={() => setSchemaOpen(false)} />
    </>
  );
}
