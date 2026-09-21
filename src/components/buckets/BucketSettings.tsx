"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TimePicker } from "@/components/ui/TimePicker";
import { DurationInput } from "@/components/ui/DurationInput";
import {
  type SortBy,
  type NotificationMedium,
  type PersonalityTone,
  type RepeatMode,
  SORT_OPTIONS,
  MEDIUM_OPTIONS,
  REPEAT_OPTIONS,
  BUCKET_TONE_OPTIONS,
} from "./constants";
import {
  parseDurationToMins,
  minsToDisplayStr,
  parseDurationToDays,
  daysToDisplayStr,
} from "@/lib/duration";
import { updateBucketSettingsAction } from "@/app/(app)/actions";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
type Tab = "items" | "notifications" | "personality";

interface BucketSettingsProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

// Covers both old snake_case and new camelCase formats in DB
type RawItemsRules = {
  sortBy?: string;
  sort_by?: string;
  drag?: boolean;
  readonly?: boolean;
  showCompleted?: boolean;
  show_completed?: boolean;
  defaultDeadlineOffsetDays?: number | null;
  default_deadline_offset?: string | null;
  autoArchiveAfterDays?: number | null;
  auto_archive_after?: string | null;
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

type RawPersonalityRules = {
  toneOverride?: PersonalityTone | null;
  tone_override?: PersonalityTone | null;
};

function parseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

const LABEL = "text-muted-foreground font-mono text-[10px]";
const HINT = "text-muted-foreground/50 font-mono text-[9px] leading-tight";
const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

const tabCn = (active: boolean) =>
  `font-mono text-[10px] px-2 py-1 transition-colors ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;

export function BucketSettings({ open, bucket, onClose }: BucketSettingsProps) {
  const [tab, setTab] = useState<Tab>("items");
  const [name, setName] = useState(bucket.name);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [drag, setDrag] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const [defaultDeadlineOffset, setDefaultDeadlineOffset] = useState("");
  const [autoArchiveAfter, setAutoArchiveAfter] = useState("");

  const [mediums, setMediums] = useState<NotificationMedium[]>([]);
  const [notifyAt, setNotifyAt] = useState("");
  const [defaultOffset, setDefaultOffset] = useState("");
  const [repeat, setRepeat] = useState<RepeatMode>("once");

  const [toneOverride, setToneOverride] = useState<PersonalityTone | "inherit">("inherit");

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
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
      setAutoArchiveAfter(
        ir.autoArchiveAfterDays !== null && ir.autoArchiveAfterDays !== undefined
          ? daysToDisplayStr(ir.autoArchiveAfterDays)
          : (ir.auto_archive_after ?? "")
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

      const pr = parseJson<RawPersonalityRules>(bucket.personalityRules, {});
      setToneOverride(
        (pr.toneOverride ?? pr.tone_override ?? "inherit") as PersonalityTone | "inherit"
      );
    }, 0);
    return () => clearTimeout(id);
  }, [open, bucket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMedium(m: NotificationMedium) {
    setMediums((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

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
          autoArchiveAfterDays: parseDurationToDays(autoArchiveAfter),
        },
        {
          medium: mediums,
          notifyAt: notifyAt || undefined,
          defaultOffsetMins: parseDurationToMins(defaultOffset) ?? undefined,
          repeat,
        },
        { toneOverride: toneOverride === "inherit" ? null : toneOverride }
      );
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

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
            className="fixed inset-0 z-50 bg-black"
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[12%] left-1/2 z-50 w-full max-w-sm -translate-x-1/2"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background overflow-hidden border-2">
              <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
                <span className="font-pixel text-xs">bucket settings</span>
                <BracketButton variant="inverted" onClick={onClose}>
                  x
                </BracketButton>
              </div>

              <div className="flex flex-col gap-4 px-4 pt-4 pb-0">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={pending}
                    className={INPUT}
                  />
                  {error && <span className="text-destructive font-mono text-[10px]">{error}</span>}
                </div>
                <div className="border-border flex border-b">
                  {(["items", "notifications", "personality"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={tabCn(tab === t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 px-4 py-4">
                {tab === "items" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>sort by</label>
                      <span className={HINT}>how items are ordered in this bucket</span>
                      <OptionGroup options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
                    </div>
                    {sortBy === "manual" && (
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>allow drag</label>
                        <span className={HINT}>let you drag items to reorder them manually</span>
                        <Toggle value={drag} onChange={setDrag} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>show completed</label>
                      <span className={HINT}>keep completed items visible in the list</span>
                      <Toggle value={showCompleted} onChange={setShowCompleted} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>read only</label>
                      <span className={HINT}>
                        prevent adding or editing items (useful for synced buckets)
                      </span>
                      <Toggle value={readonly} onChange={setReadonly} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>default deadline offset</label>
                      <span className={HINT}>
                        when adding an item, pre-fill the deadline this far from today
                      </span>
                      <DurationInput
                        value={defaultDeadlineOffset}
                        onChange={setDefaultDeadlineOffset}
                        placeholder="e.g. 7 days, 2 weeks"
                        disabled={pending}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>auto archive after</label>
                      <span className={HINT}>
                        automatically move completed items to archive after this long
                      </span>
                      <DurationInput
                        value={autoArchiveAfter}
                        onChange={setAutoArchiveAfter}
                        placeholder="e.g. 1 day, 7 days"
                        disabled={pending}
                      />
                    </div>
                  </>
                )}
                {tab === "notifications" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>medium</label>
                      <span className={HINT}>
                        where to send notifications — ntfy is push, email is inbox
                      </span>
                      <OptionGroup
                        options={MEDIUM_OPTIONS}
                        value={mediums}
                        onChange={toggleMedium}
                        multi
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>notify at</label>
                      <span className={HINT}>
                        time of day to deliver the notification (e.g. 9 am, 6 pm)
                      </span>
                      <TimePicker value={notifyAt} onChange={setNotifyAt} disabled={pending} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>offset before deadline</label>
                      <span className={HINT}>
                        how far in advance to notify — leave empty to notify at the deadline
                      </span>
                      <DurationInput
                        value={defaultOffset}
                        onChange={setDefaultOffset}
                        placeholder="e.g. 3 days, 1 hour — empty = at deadline"
                        disabled={pending}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>repeat</label>
                      <span className={HINT}>
                        once = notify one time only · daily = re-notify every day until done
                      </span>
                      <OptionGroup options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
                    </div>
                  </>
                )}
                {tab === "personality" && (
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>tone override</label>
                    <span className={HINT}>
                      use a different AI tone for items in this bucket — inherit uses your global
                      setting
                    </span>
                    <OptionGroup
                      options={BUCKET_TONE_OPTIONS}
                      value={toneOverride}
                      onChange={setToneOverride}
                    />
                  </div>
                )}
              </div>

              <div className="border-border flex items-center justify-end border-t px-3 py-2.5">
                <BracketButton onClick={handleSave} disabled={!name.trim() || pending}>
                  save
                </BracketButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
