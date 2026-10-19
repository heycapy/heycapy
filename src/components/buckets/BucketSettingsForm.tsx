import { ACCENT_BUTTONS, BOX, SECTION, HINT, LABEL } from "@/components/layout/settings-constants";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, toggled } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { BracketButton } from "@/components/ui/BracketButton";
import { BetaTag } from "@/components/ui/BetaTag";
import { BucketRulesFields } from "./BucketRulesFields";
import { ViewOnlyNotice } from "./ViewOnlyNotice";
import { MyChannelsPicker, type NotifAvailability } from "./MyChannelsPicker";
import { parseBucketSettings, type BucketSettingsValues } from "./parseBucketSettings";
import { parseDurationToDays } from "@/lib/duration";
import {
  updateBucketSettingsAction,
  updateMyChannelsAction,
  archiveBucketAction,
  deleteBucketAction,
  getNotifAvailabilityAction,
  getBucketDefaultsAction,
} from "@/app/(app)/actions";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import type { ViewerBucket } from "@/lib/buckets/access";
import { memberChannels } from "@/lib/rules";
import type { MemberChannels } from "@/types/rules";
import { FollowTag } from "./FollowTag";
import { BucketMembersPanel } from "./BucketMembersPanel";

export type SettingsTab = "items" | "notifications" | "advanced" | "members";

const OWNER_TABS: SettingsTab[] = ["items", "notifications", "advanced", "members"];
// A member sees the bucket's rules but changes only where their own reminders go
const MEMBER_TABS: SettingsTab[] = ["items", "notifications", "members"];

const tabCn = (active: boolean) =>
  `font-mono text-xs px-2 py-1 transition-colors shrink-0 whitespace-nowrap ${active ? "bg-foreground text-background" : "text-primary hover:text-foreground"}`;

type BucketSettingsFormProps = {
  bucket: ViewerBucket;
  clocksDiffer: boolean;
  onClose: () => void;
  onOpenSchema: () => void;
  onOpenTelegram: () => void;
  onOpenWebhook: () => void;
  initialTab?: SettingsTab;
};

// Mounted fresh on every open, so the form always starts from the saved settings
export function BucketSettingsForm({
  bucket,
  clocksDiffer,
  onClose,
  onOpenSchema,
  onOpenTelegram,
  onOpenWebhook,
  initialTab = "items",
}: BucketSettingsFormProps) {
  const router = useRouter();
  const nameId = useId();
  const tabs = bucket.isOwner ? OWNER_TABS : MEMBER_TABS;
  const [tab, setTab] = useState<SettingsTab>(tabs.includes(initialTab) ? initialTab : tabs[0]);
  const [values, setValues] = useState<BucketSettingsValues>(() => parseBucketSettings(bucket));
  const [channels, setChannels] = useState<MemberChannels>(() => memberChannels(bucket.myChannels));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifAvailability, setNotifAvailability] = useState<NotifAvailability>();
  const [defaults, setDefaults] = useState<Awaited<ReturnType<typeof getBucketDefaultsAction>>>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getNotifAvailabilityAction().then((result) => {
      if (!cancelled) setNotifAvailability(result);
    });
    void getBucketDefaultsAction().then((result) => {
      if (!cancelled) setDefaults(result);
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
      const result = !bucket.isOwner
        ? await updateMyChannelsAction(bucket.id, channels)
        : await updateBucketSettingsAction(
            bucket.id,
            values.name,
            {
              sortBy: values.sortBy,
              drag: values.drag,
              readonly: values.readonly,
              showCompleted: values.showCompleted,
              recurrenceMode: values.recurrenceMode,
              defaultDeadlineOffsetDays: parseDurationToDays(values.defaultDeadlineOffset),
            },
            {
              reminderButtons: values.reminderButtons,
              notifyAt: values.notifyAt || undefined,
              defaultReminders: values.defaultReminders,
              repeat: values.repeat,
            },
            {
              notifyOnArrival: values.notifyOnArrival,
              notifyWhenOverdue: values.notifyWhenOverdue,
              overdueRepeatHours: values.overdueRepeatHours,
              overdueFirstAlertMins: values.overdueFirstAlertMins,
            },
            channels,
            values.followsTweaks
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

  const showSave = tab === "notifications" || (bucket.isOwner && tab === "items");

  return (
    <div
      className={cn(
        "border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2",
        ACCENT_BUTTONS
      )}
    >
      <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <span className="font-pixel min-w-0 truncate text-xs">bucket settings [{bucket.name}]</span>
        <BracketButton variant="inverted" onClick={onClose}>
          x
        </BracketButton>
      </div>

      <div className="flex shrink-0 flex-col gap-4 px-4 pt-4 pb-0">
        {bucket.isOwner && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className={LABEL}>
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
                  "text-right font-mono text-[11px] transition-colors",
                  charCountColor(values.name.length, BUCKET_NAME_MAX_LENGTH)
                )}
              >
                {values.name.length}/{BUCKET_NAME_MAX_LENGTH}
              </p>
            )}
            {error && <span className="text-destructive font-mono text-xs">{error}</span>}
          </div>
        )}
        <div className="border-border flex overflow-x-auto border-b">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={tabCn(tab === t)}>
              {t}
              {/* the tab row is just wide enough for the four names on a phone */}
              {t === "members" && <BetaTag feature="sharing" className="hidden sm:inline" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {!bucket.isOwner && (tab === "items" || tab === "notifications") && (
          <ViewOnlyNotice tab={tab} />
        )}

        {tab === "notifications" && (
          <div className={BOX}>
            <span className={SECTION}>where</span>
            <MyChannelsPicker
              mediums={channels.medium}
              webhooks={channels.webhooks}
              onMediumToggle={(m) =>
                setChannels((prev) => ({
                  ...prev,
                  medium: toggled(prev.medium, m),
                  followsTweaks: false,
                }))
              }
              onWebhookToggle={(id) =>
                setChannels((prev) => ({
                  ...prev,
                  webhooks: toggled(prev.webhooks, id),
                  followsTweaks: false,
                }))
              }
              notifAvailability={notifAvailability}
              labelTag={
                <FollowTag
                  following={!!channels.followsTweaks}
                  onUseTweaks={() => defaults && setChannels(defaults.channels)}
                  disabled={pending || !defaults}
                />
              }
            />
          </div>
        )}

        {(tab === "items" || tab === "notifications") && (
          <BucketRulesFields
            activeTab={tab}
            values={values}
            setValues={setValues}
            clocksDiffer={clocksDiffer}
            disabled={pending}
            locked={!bucket.isOwner}
            defaults={defaults?.rules}
          />
        )}

        {bucket.isOwner && tab === "notifications" && (
          <div className={BOX}>
            <span className={SECTION}>telegram bot</span>
            <p className={HINT}>
              set an alias shortcut, deadline buttons, time slots, and recurring options
            </p>
            <BracketButton onClick={onOpenTelegram} className="w-fit">
              configure telegram
            </BracketButton>
          </div>
        )}

        {tab === "members" && <BucketMembersPanel bucket={bucket} onLeft={onClose} />}

        {tab === "advanced" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <p className={LABEL}>schema</p>
              <p className={HINT}>define custom fields and notification rules for this bucket</p>
              <BracketButton onClick={onOpenSchema} className="w-fit">
                configure schema
              </BracketButton>
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-1.5">
              <p className={LABEL}>webhook</p>
              <p className={HINT}>receive items from external services via HTTP</p>
              <BracketButton onClick={onOpenWebhook} className="w-fit">
                configure webhook
              </BracketButton>
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-3">
              <p className={LABEL}>danger zone</p>
              <p className={cn(HINT, "leading-relaxed")}>
                archived and deleted buckets can be accessed via the header — use archive to hide a
                bucket, or delete to move it to trash.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <BracketButton variant="warning" onClick={handleArchive} disabled={pending}>
                  archive
                </BracketButton>
                {confirmDelete ? (
                  <>
                    <span className="text-destructive font-mono text-xs">sure?</span>
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
        <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t px-3 py-2.5">
          {!bucket.isOwner && error && (
            <span className="text-destructive mr-auto font-mono text-xs">{error}</span>
          )}
          <BracketButton onClick={handleSave} disabled={!values.name.trim() || pending}>
            save
          </BracketButton>
        </div>
      )}
    </div>
  );
}
