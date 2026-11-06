import { Scale } from "pixelarticons/react/Scale.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { useState, type CSSProperties, type RefObject } from "react";
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
import { parseItemsRules } from "@/lib/rules";
import { browserTimezone, moveClock } from "@/lib/time";
import { ADD_BOX_EXAMPLES } from "./constants";
import { defaultDeadline } from "./defaultDeadline";
import { parseFields } from "./fields";
import { MentionList } from "./MentionList";
import { useBucketMembers } from "./useBucketMembers";
import { useItemClock } from "./useItemClock";
import type { AddDraft } from "./useItemEditor";

type QuickAddProps = {
  bucket: ViewerBucket;
  color: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdded: () => void;
  onExpand: (draft: AddDraft) => void;
};

export function QuickAdd({ bucket, color, inputRef, onAdded, onExpand }: QuickAddProps) {
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);
  const members = useBucketMembers(bucket.id, null);
  const clock = useItemClock(members, assigneeId);

  const bucketName = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
  // the form checks required fields, the box can't
  const needsForm = parseFields(bucket.fieldSchema).some((f) => f.validation?.required);
  const typedDate = findTitleDate(text);
  const assignee = members.find((m) => m.userId === assigneeId);
  const found = members.length > 1 ? findMention(text, caret) : null;
  const options = found ? mentionOptions(members, found.query) : [];
  const listOpen = options.length > 0 && closedOn !== text;
  const hint = [
    typedDate && describeDeadline(typedDate.deadline),
    assignee && `@${memberName(assignee)}`,
  ].filter(Boolean);

  function clear() {
    setText("");
    setAssigneeId(null);
    setCaret(0);
  }

  function expand() {
    onExpand({ title: text, assigneeId });
    clear();
  }

  function submit() {
    const title = text.trim();
    if (!title) return;
    if (needsForm) {
      expand();
      return;
    }
    const deadline = typedDate
      ? moveClock(typedDate.deadline, browserTimezone(), clock.zone)
      : defaultDeadline(parseItemsRules(bucket.itemsRules).defaultDeadlineOffsetDays);
    const sent = { text, assigneeId };
    // cleared at once so the next item can be typed while this one saves
    clear();
    void (async () => {
      const result = await addItemAction(
        bucket.id,
        typedDate?.title ?? title,
        deadline || null,
        undefined,
        null,
        null,
        null,
        sent.assigneeId,
        clock.clock
      );
      if (result.ok) {
        onAdded();
        return;
      }
      toast.error(result.error);
      setText((current) => current || sent.text);
      setAssigneeId((current) => current ?? sent.assigneeId);
    })();
  }

  function pick(option: MentionOption) {
    if (!found) return;
    const next = removeMention(text, found);
    setText(next.text);
    setCaret(next.caret);
    setAssigneeId(option.userId);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.caret, next.caret));
  }

  return (
    <div
      data-testid="add-box"
      style={{ "--accent": color } as CSSProperties}
      className="border-border bg-card relative flex min-w-0 flex-1 flex-col border-2 focus-within:border-(--accent)"
    >
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
            setText(e.target.value);
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
          }}
          placeholder={ADD_BOX_EXAMPLES[bucket.id % ADD_BOX_EXAMPLES.length]}
          aria-label={`add to ${bucketName}`}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          enterKeyHint="done"
          autoComplete="off"
          className="placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent py-1 font-mono text-base outline-none sm:text-sm"
        />
        <button
          type="button"
          onClick={expand}
          aria-label="add with details"
          className="text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center transition-colors"
        >
          <PixelIcon icon={Scale} />
        </button>
      </div>
      {hint.length > 0 && (
        <p
          data-testid="quick-add-hint"
          className="-mt-1.5 pb-1.5 pl-8.5 font-mono text-[11px] text-(--accent)"
        >
          → {hint.join(" · ")}
        </p>
      )}
    </div>
  );
}
