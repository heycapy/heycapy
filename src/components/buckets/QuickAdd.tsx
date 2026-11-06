import { Scale } from "pixelarticons/react/Scale.js";
import { Close } from "pixelarticons/react/Close.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { useState, type RefObject } from "react";
import { toast } from "sonner";
import { addItemAction } from "@/app/(app)/actions";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";
import { memberName } from "@/lib/buckets/member-name";
import type { ViewerBucket } from "@/lib/buckets/access";
import { describeDeadline } from "@/lib/format-date";
import {
  findMention,
  mentionOptions,
  removeMention,
  type MentionOption,
} from "@/lib/items/mention";
import { findTitleDate } from "@/lib/items/title-date";
import { repeatLabel } from "@/lib/items/repeat-label";
import { parseItemsRules } from "@/lib/rules";
import { browserTimezone, moveClock } from "@/lib/time";
import { ADD_BOX_EXAMPLES } from "./constants";
import { defaultDeadline } from "./defaultDeadline";
import { parseFields } from "./fields";
import { MentionList } from "./MentionList";
import { useBucketMembers } from "./useBucketMembers";
import { useItemClock } from "./useItemClock";
import { isEmptyDraft, useDraft, useDraftStore } from "@/store/drafts";
import { useUIStore } from "@/store/ui";

type QuickAddProps = {
  bucket: ViewerBucket;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdded: () => void;
  onExpand: () => void;
};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function QuickAdd({ bucket, inputRef, onAdded, onExpand }: QuickAddProps) {
  const draft = useDraft(bucket.id);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markAdded = useUIStore((s) => s.markAdded);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);
  const members = useBucketMembers(bucket.id, null);
  const clock = useItemClock(members, draft.assigneeId);

  const text = draft.title;
  const bucketName = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
  // the form checks required fields, the box can't fill them
  const needsForm = parseFields(bucket.fieldSchema).some(
    (f) => f.validation?.required && isBlank(draft.properties[f.key])
  );
  // a date picked in the form wins over words in the title, as it does in the form
  const datePicked = draft.deadline !== null;
  const typedDate = datePicked ? null : findTitleDate(text);
  const assignee = members.find((m) => m.userId === draft.assigneeId);
  const found = members.length > 1 ? findMention(text, caret) : null;
  const options = found ? mentionOptions(members, found.query) : [];
  const listOpen = options.length > 0 && closedOn !== text;
  const hint = [
    datePicked
      ? draft.deadline && describeDeadline(draft.deadline)
      : typedDate && describeDeadline(typedDate.deadline),
    draft.recurring?.enabled && repeatLabel(draft.recurring),
    assignee && `@${memberName(assignee)}`,
    Object.keys(draft.properties).length > 0 && "+ fields",
    draft.reminders !== null && "+ reminders",
  ].filter(Boolean);

  function clear() {
    clearDraft(bucket.id);
    setCaret(0);
  }

  function submit() {
    const title = text.trim();
    if (!title) return;
    if (needsForm) {
      onExpand();
      return;
    }
    const deadline = datePicked
      ? draft.deadline
      : typedDate
        ? moveClock(typedDate.deadline, browserTimezone(), clock.zone)
        : defaultDeadline(parseItemsRules(bucket.itemsRules).defaultDeadlineOffsetDays);
    const sent = draft;
    // cleared at once so the next item can be typed while this one saves
    clear();
    void (async () => {
      const result = await addItemAction(
        bucket.id,
        typedDate?.title ?? title,
        deadline || null,
        sent.status ?? undefined,
        sent.recurring,
        Object.keys(sent.properties).length > 0 ? sent.properties : null,
        sent.reminders,
        sent.assigneeId,
        clock.clock
      );
      if (result.ok) {
        markAdded(result.id);
        onAdded();
        return;
      }
      toast.error(result.error);
      const current = useDraftStore.getState().drafts[bucket.id];
      if (!current || isEmptyDraft(current)) updateDraft(bucket.id, sent);
    })();
  }

  function pick(option: MentionOption) {
    if (!found) return;
    const next = removeMention(text, found);
    updateDraft(bucket.id, { title: next.text, assigneeId: option.userId });
    setCaret(next.caret);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.caret, next.caret));
  }

  return (
    <div
      data-testid="add-box"
      className="group/add relative flex min-h-12 min-w-0 flex-1 flex-col justify-center"
    >
      {/* while typing, the footer's top line takes the bucket colour above the box only */}
      <span
        aria-hidden
        className="absolute inset-x-0 -top-0.5 hidden h-0.5 bg-(--accent) group-focus-within/add:block"
      />
      {listOpen && (
        <div className="bg-background absolute inset-x-0 bottom-full mb-2">
          <MentionList
            options={options}
            highlighted={Math.min(highlighted, options.length - 1)}
            onPick={pick}
            onHover={setHighlighted}
          />
        </div>
      )}
      <div className="flex items-center gap-2 pl-2.5">
        <PixelIcon icon={Plus} className="shrink-0 text-(--accent)" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            updateDraft(bucket.id, { title: e.target.value });
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setHighlighted(0);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          data-handles-escape={listOpen || undefined}
          onKeyDown={(e) => {
            if (listOpen) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setHighlighted((highlighted + step + options.length) % options.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(options[Math.min(highlighted, options.length - 1)]);
                return;
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setClosedOn(text);
                return;
              }
            }
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") clear();
          }}
          placeholder={ADD_BOX_EXAMPLES[bucket.id % ADD_BOX_EXAMPLES.length]}
          aria-label={`add to ${bucketName}`}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          enterKeyHint="done"
          autoComplete="off"
          className="placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent py-1 font-mono text-base outline-none sm:text-sm"
        />
        {/* on the row, not under it, so the footer keeps its height */}
        {hint.length > 0 && (
          <span
            data-testid="quick-add-hint"
            className="max-w-24 shrink-0 truncate font-mono text-[11px] text-(--accent) sm:max-w-[45%]"
          >
            → {hint.join(" · ")}
          </span>
        )}
        {!isEmptyDraft(draft) && (
          <button
            type="button"
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            aria-label="clear"
            className="text-muted-foreground hover:text-foreground flex h-11 w-9 shrink-0 items-center justify-center transition-colors"
          >
            <PixelIcon icon={Close} />
          </button>
        )}
        <button
          type="button"
          onClick={onExpand}
          aria-label="add with details"
          className="text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center transition-colors"
        >
          <PixelIcon icon={Scale} />
        </button>
      </div>
    </div>
  );
}
