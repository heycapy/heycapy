import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { describeDeadline } from "@/lib/format-date";
import {
  findMention,
  mentionOptions,
  removeMention,
  type MentionMember,
  type MentionOption,
} from "@/lib/items/mention";
import type { TitleDate } from "@/lib/items/title-date";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";
import { MentionList } from "./MentionList";
import { LABEL } from "@/components/layout/settings-constants";

// Shared by the textarea and the highlight layer behind it, so their text lines up exactly
const TEXT = "w-full border-b text-base break-words whitespace-pre-wrap";

function fitHeight(el: HTMLTextAreaElement) {
  const top = el.scrollTop;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  el.scrollTop = el.selectionEnd === el.value.length ? el.scrollHeight : top;
}

type ItemTitleFieldProps = {
  open: boolean;
  boxed?: boolean;
  value: string;
  error?: string;
  showRequired: boolean;
  disabled?: boolean;
  typedDate: TitleDate | null;
  // Typing @ in a shared bucket offers its members, picking one assigns the item
  mention?: { members: MentionMember[]; onPick: (userId: number | null) => void };
  onChange: (v: string) => void;
  onDismissDate: () => void;
};

export function ItemTitleField({
  open,
  boxed,
  value,
  error,
  showRequired,
  disabled,
  typedDate,
  mention,
  onChange,
  onDismissDate,
}: ItemTitleFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const caretAfterPick = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);

  const text = cn(TEXT, boxed ? "max-h-[4lh]" : "max-h-[calc(4lh+0.75rem)] py-1.5 sm:text-sm");

  const found = mention ? findMention(value, caret) : null;
  const options = found && mention ? mentionOptions(mention.members, found.query) : [];
  const listOpen = found !== null && options.length > 0 && closedOn !== value;

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const el = textareaRef.current;
    if (!el) return;
    fitHeight(el);
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [open, disabled]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || caretAfterPick.current === null) return;
    fitHeight(el);
    el.setSelectionRange(caretAfterPick.current, caretAfterPick.current);
    caretAfterPick.current = null;
  }, [value]);

  useLayoutEffect(() => {
    if (highlightRef.current && textareaRef.current)
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
  });

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    setCaret(e.target.selectionStart);
    setHighlighted(0);
    fitHeight(e.target);
  }

  function pick(option: MentionOption) {
    if (!found || !mention) return;
    const next = removeMention(value, found);
    caretAfterPick.current = next.caret;
    setCaret(next.caret);
    onChange(next.text);
    mention.onPick(option.userId);
  }

  return (
    <div data-title-section className={cn("flex flex-col gap-1.5", boxed ? "relative" : "pb-5")}>
      <label className={cn(LABEL, showRequired && "text-destructive", boxed && "sr-only")}>
        title
      </label>
      <div className={cn(boxed && "flex items-start gap-2")}>
        <div className={cn("min-w-0 flex-1", boxed && "py-3")}>
          {boxed && typedDate && (
            <p className="font-ui text-2xs flex items-center gap-1.5 pb-1">
              <span className="truncate text-(--accent)">
                {describeDeadline(typedDate.deadline)}
              </span>
              <button
                type="button"
                onClick={onDismissDate}
                className="text-muted-foreground hover:text-foreground shrink-0 underline underline-offset-2"
              >
                not a date
              </button>
            </p>
          )}
          <div className="relative">
            {typedDate && (
              <div
                ref={highlightRef}
                aria-hidden
                data-testid="title-date-highlight"
                className={cn(
                  text,
                  "text-foreground pointer-events-none absolute inset-0 overflow-hidden border-transparent",
                  disabled && "opacity-50"
                )}
              >
                {value.slice(0, typedDate.start)}
                <span className="text-primary">{value.slice(typedDate.start, typedDate.end)}</span>
                {value.slice(typedDate.end)}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onScroll={(e) => {
                if (highlightRef.current)
                  highlightRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
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
                    setClosedOn(value);
                    return;
                  }
                }
              }}
              placeholder={boxed && showRequired ? "title is required" : "what needs doing?"}
              maxLength={ITEM_TITLE_MAX_LENGTH}
              disabled={disabled}
              rows={1}
              className={cn(
                text,
                !boxed && "focus:border-foreground",
                "scrollbar-hide relative block resize-none overflow-y-auto bg-transparent outline-none disabled:opacity-50",
                // The layer behind draws the text so the date words can take their own colour
                typedDate && "caret-foreground text-transparent",
                error || showRequired
                  ? "border-destructive placeholder:text-destructive/50"
                  : "border-border placeholder:text-muted-foreground",
                boxed && "border-transparent"
              )}
            />
          </div>
        </div>
      </div>
      {listOpen && (
        <div className={cn(boxed && "bg-background absolute inset-x-0 bottom-full mb-1")}>
          <MentionList
            options={options}
            highlighted={Math.min(highlighted, options.length - 1)}
            onPick={pick}
            onHover={setHighlighted}
          />
        </div>
      )}
      {showRequired && !boxed && (
        <p className="text-destructive font-ui text-2xs">title is required</p>
      )}
      {error && (
        <p role="alert" className={cn("text-destructive font-ui text-2xs", boxed && "pb-2")}>
          {error}
        </p>
      )}
      {typedDate && !boxed && (
        <div className="flex items-center gap-2">
          <span className="rounded-control border-primary text-foreground font-ui border px-2 py-1 text-xs">
            due {describeDeadline(typedDate.deadline)}
          </span>
          <TextButton onClick={onDismissDate} aria-label="not a date" className="px-1">
            ×
          </TextButton>
        </div>
      )}
    </div>
  );
}
