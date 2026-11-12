import { useState, type RefObject } from "react";
import { notify } from "@/components/ui/notify";
import { mentionAssignees } from "./assignee";
import { addItemAction } from "@/app/(app)/actions";
import { IconButton } from "@/components/ui/IconButton";
import { InputBar, InputBarAction, InputBarIcon } from "@/components/ui/InputBar";
import { KeyHint, SubmitKeyHint } from "@/components/ui/KeyHint";
import { ITEM_TITLE_MAX_LENGTH, MOBILE_MEDIA_QUERY } from "@/constants";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
import { ADD_BOX_EXAMPLES, ADD_BOX_EXAMPLES_SHORT } from "./constants";
import { defaultDeadline } from "./defaultDeadline";
import { parseFields } from "./fields";
import { MentionList } from "./MentionList";
import { ExpandHandle } from "./AddBoxControls";
import { BucketTargetPicker } from "./BucketTargetPicker";
import { useBucketMembers } from "./useBucketMembers";
import { useItemClock } from "./useItemClock";
import { EMPTY_DRAFT, isEmptyDraft, useDraft, useDraftStore } from "@/store/drafts";
import { useUIStore } from "@/store/ui";

type QuickAddProps = {
  bucket: ViewerBucket;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdded: () => void;
  onExpand: () => void;
  targets?: { buckets: ViewerBucket[]; onPick: (bucketId: number) => void };
};

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function QuickAdd({ bucket, inputRef, onAdded, onExpand, targets }: QuickAddProps) {
  const draft = useDraft(bucket.id);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markAdded = useUIStore((s) => s.markAdded);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);
  const members = useBucketMembers(bucket.id, null);
  const isPhone = useMediaQuery(MOBILE_MEDIA_QUERY);
  const clock = useItemClock(members, draft.assigneeIds);

  const text = draft.title;
  const bucketName = bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
  const needsForm = parseFields(bucket.fieldSchema).some(
    (f) => f.validation?.required && isBlank(draft.properties[f.key])
  );
  const datePicked = draft.deadline !== null;
  const hasDetails = !isEmptyDraft({ ...draft, title: "" });
  const typedDate = datePicked ? null : findTitleDate(text);
  const named = members.filter((m) => draft.assigneeIds?.includes(m.userId));
  const found = members.length > 1 ? findMention(text, caret) : null;
  const options = found ? mentionOptions(members, found.query) : [];
  const listOpen = options.length > 0 && closedOn !== text;
  const hint = [
    datePicked
      ? draft.deadline && describeDeadline(draft.deadline)
      : typedDate && describeDeadline(typedDate.deadline),
    draft.recurring?.enabled && repeatLabel(draft.recurring),
    ...named.map((m) => `@${memberName(m)}`),
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
        sent.assigneeIds ?? undefined,
        clock.clock
      );
      if (result.ok) {
        markAdded(result.id);
        onAdded();
        return;
      }
      notify.error(result.error);
      const current = useDraftStore.getState().drafts[bucket.id];
      if (!current || isEmptyDraft(current)) updateDraft(bucket.id, sent);
    })();
  }

  function pick(option: MentionOption) {
    if (!found) return;
    const next = removeMention(text, found);
    updateDraft(bucket.id, {
      title: next.text,
      assigneeIds:
        option.userId === null ? null : mentionAssignees(members, draft.assigneeIds, option.userId),
    });
    setCaret(next.caret);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.caret, next.caret));
  }

  return (
    <div
      data-testid="add-box"
      className="group/add relative flex min-h-(--add-box-h) min-w-0 flex-1 flex-col justify-center"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 -top-0.5 hidden h-0.5 bg-(--accent) group-focus-within/add:[display:var(--add-focus-line)]"
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
      {isPhone && <ExpandHandle onExpand={onExpand} />}
      {hint.length > 0 && (
        <div className="flex items-center gap-1 pt-1.5 pr-2 pl-2.5">
          <span data-testid="quick-add-hint" className="font-ui text-2xs truncate text-(--accent)">
            {hint.join(" · ")}
          </span>
          {hasDetails && (
            <IconButton
              icon="close"
              aria-label="clear details"
              onClick={() => updateDraft(bucket.id, { ...EMPTY_DRAFT, title: draft.title })}
              className="flex size-5 items-center justify-center"
            />
          )}
        </div>
      )}
      <InputBar>
        {targets && (
          <BucketTargetPicker bucket={bucket} buckets={targets.buckets} onPick={targets.onPick} />
        )}
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
          placeholder={
            (isPhone ? ADD_BOX_EXAMPLES_SHORT : ADD_BOX_EXAMPLES)[
              bucket.id % ADD_BOX_EXAMPLES.length
            ]
          }
          aria-label={`add to ${bucketName}`}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          enterKeyHint="done"
          autoComplete="off"
          className="placeholder:text-muted-foreground/50 font-ui min-w-0 flex-1 bg-transparent py-1 text-base outline-none sm:text-sm"
        />
        <KeyHint action="quick-add" className="ml-0" />
        {!isPhone && (
          <InputBarIcon
            icon="expand"
            label="add with details"
            hint="add-with-details"
            onClick={onExpand}
          />
        )}
        {text.trim() && (
          <>
            <SubmitKeyHint className="ml-0" />
            <InputBarAction icon="arrow-up" label="add" name="add item" onClick={submit} />
          </>
        )}
      </InputBar>
    </div>
  );
}
