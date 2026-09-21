"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { OptionButton } from "@/components/ui/OptionButton";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  type ItemsRulesConfig,
  type NotificationsRulesConfig,
  type PersonalityRulesConfig,
  type SortBy,
  type NotificationMedium,
  type PersonalityTone,
  type RepeatMode,
} from "./constants";
import { updateBucketSettingsAction } from "@/app/(app)/actions";
import { DurationInput } from "@/components/ui/DurationInput";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;
type Tab = "items" | "notifications" | "personality";

interface BucketSettingsProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

function parseItemsRules(json: string): ItemsRulesConfig {
  try {
    return JSON.parse(json) as ItemsRulesConfig;
  } catch {
    return {};
  }
}
function parseNotificationsRules(json: string): NotificationsRulesConfig {
  try {
    return JSON.parse(json) as NotificationsRulesConfig;
  } catch {
    return {};
  }
}
function parsePersonalityRules(json: string): PersonalityRulesConfig {
  try {
    return JSON.parse(json) as PersonalityRulesConfig;
  } catch {
    return {};
  }
}

const LABEL = "text-muted-foreground font-mono text-[10px]";
const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1">
      <OptionButton active={value} onClick={() => onChange(true)}>
        on
      </OptionButton>
      <OptionButton active={!value} onClick={() => onChange(false)}>
        off
      </OptionButton>
    </div>
  );
}

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  multi,
}: {
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = multi ? (value as T[]).includes(opt.value) : (value as T) === opt.value;
        return (
          <OptionButton key={opt.value} active={active} onClick={() => onChange(opt.value)}>
            {opt.label}
          </OptionButton>
        );
      })}
    </div>
  );
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "deadline", label: "deadline" },
  { value: "created_at", label: "created" },
  { value: "manual", label: "manual" },
];
const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "once" },
  { value: "daily", label: "daily" },
];
const TONE_OPTIONS: { value: PersonalityTone | "inherit"; label: string }[] = [
  { value: "inherit", label: "inherit" },
  { value: "chill", label: "chill" },
  { value: "professional", label: "professional" },
  { value: "motivational", label: "motivational" },
  { value: "custom", label: "custom" },
];
const MEDIUM_OPTIONS: { value: NotificationMedium; label: string }[] = [
  { value: "ntfy", label: "ntfy" },
  { value: "email", label: "email" },
];

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

      const ir = parseItemsRules(bucket.itemsRules);
      setSortBy(ir.sort_by ?? "created_at");
      setDrag(ir.drag ?? false);
      setShowCompleted(ir.show_completed !== false);
      setReadonly(ir.readonly ?? false);
      setDefaultDeadlineOffset(ir.default_deadline_offset ?? "");
      setAutoArchiveAfter(ir.auto_archive_after ?? "");

      const nr = parseNotificationsRules(bucket.notificationsRules);
      setMediums(nr.medium ?? []);
      setNotifyAt(nr.notify_at ?? "");
      setDefaultOffset(nr.default_offset ?? "");
      setRepeat(nr.repeat ?? "once");

      const pr = parsePersonalityRules(bucket.personalityRules);
      setToneOverride(pr.tone_override ?? "inherit");
    }, 0);
    return () => clearTimeout(id);
  }, [open, bucket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMedium(m: NotificationMedium) {
    setMediums((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function handleSave() {
    if (pending) return;
    setError("");
    const itemsRules: ItemsRulesConfig = {
      sort_by: sortBy,
      drag,
      readonly,
      show_completed: showCompleted,
      default_deadline_offset: defaultDeadlineOffset || null,
      auto_archive_after: autoArchiveAfter || null,
    };
    const notificationsRules: NotificationsRulesConfig = {
      medium: mediums,
      notify_at: notifyAt || undefined,
      default_offset: defaultOffset || undefined,
      repeat,
    };
    const personalityRules: PersonalityRulesConfig = {
      tone_override: toneOverride === "inherit" ? null : toneOverride,
    };
    startTransition(async () => {
      const result = await updateBucketSettingsAction(
        bucket.id,
        name,
        itemsRules,
        notificationsRules,
        personalityRules
      );
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const tabBtn = (t: Tab) =>
    cn(
      "font-mono text-[10px] px-2 py-1 transition-colors",
      tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
    );

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
                    <button key={t} onClick={() => setTab(t)} className={tabBtn(t)}>
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
                      <OptionGroup options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
                    </div>

                    {sortBy === "manual" && (
                      <div className="flex flex-col gap-1.5">
                        <label className={LABEL}>allow drag</label>
                        <Toggle value={drag} onChange={setDrag} />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>show completed</label>
                      <Toggle value={showCompleted} onChange={setShowCompleted} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>read only</label>
                      <Toggle value={readonly} onChange={setReadonly} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>default deadline offset</label>
                      <DurationInput
                        value={defaultDeadlineOffset}
                        onChange={setDefaultDeadlineOffset}
                        placeholder="e.g. 7 days, 2 weeks"
                        disabled={pending}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>auto archive after</label>
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
                      <OptionGroup
                        options={MEDIUM_OPTIONS}
                        value={mediums}
                        onChange={toggleMedium}
                        multi
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>notify at</label>
                      <TimePicker value={notifyAt} onChange={setNotifyAt} disabled={pending} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>offset before deadline</label>
                      <DurationInput
                        value={defaultOffset}
                        onChange={setDefaultOffset}
                        placeholder="e.g. 3 days, 1 hour"
                        disabled={pending}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className={LABEL}>repeat</label>
                      <OptionGroup options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
                    </div>
                  </>
                )}

                {tab === "personality" && (
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>tone override</label>
                    <OptionGroup
                      options={TONE_OPTIONS}
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
