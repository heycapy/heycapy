import { Plus } from "pixelarticons/react/Plus.js";
import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { BracketButton } from "@/components/ui/BracketButton";
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

type ItemTitleFieldProps = {
  open: boolean;
  // drawn as the add box it grew from: no label or underline, the date's [×] on the same row
  boxed?: boolean;
  value: string;
  error?: string;
  showRequired: boolean;
  disabled?: boolean;
  typedDate: TitleDate | null;
  // Typing @ in a shared bucket offers its members, picking one assigns the item
  mention?: { members: MentionMember[]; onPick: (userId: number | null) => void };
  onChange: (v: string) => void;
  onEnter: () => void;
  onDismissDate: () => void;
};

export function ItemTitleField({
  open,
  boxed = false,
  value,
  error,
  showRequired,
  disabled,
  typedDate,
  mention,
  onChange,
  onEnter,
  onDismissDate,
}: ItemTitleFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretAfterPick = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);

  const text = cn(TEXT, boxed ? "py-3" : "py-1.5 sm:text-sm");

  const found = mention ? findMention(value, caret) : null;
  const options = found && mention ? mentionOptions(mention.members, found.query) : [];
  const listOpen = found !== null && options.length > 0 && closedOn !== value;

  // A form opened while the last add is still saving starts disabled, and can only take focus after
  useLayoutEffect(() => {
    if (!open || disabled) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [open, disabled]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || caretAfterPick.current === null) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.setSelectionRange(caretAfterPick.current, caretAfterPick.current);
    caretAfterPick.current = null;
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    setCaret(e.target.selectionStart);
    setHighlighted(0);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
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
        {boxed && <PixelIcon icon={Plus} className="mt-4.5 shrink-0 text-(--accent)" />}
        <div className="relative min-w-0 flex-1">
          {typedDate && (
            <div
              aria-hidden
              data-testid="title-date-highlight"
              className={cn(
                text,
                "text-foreground pointer-events-none absolute inset-0 border-transparent",
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
              if (e.key === "Enter" && !e.shiftKey && value.trim()) {
                e.preventDefault();
                onEnter();
              }
            }}
            // in the panel the row stays put: the empty title says what's missing itself
            placeholder={boxed && showRequired ? "title is required" : "what needs doing?"}
            maxLength={ITEM_TITLE_MAX_LENGTH}
            disabled={disabled}
            rows={1}
            className={cn(
              text,
              !boxed && "focus:border-foreground",
              "relative block resize-none overflow-hidden bg-transparent outline-none disabled:opacity-50",
              // The layer behind draws the text so the date words can take their own colour
              typedDate && "caret-foreground text-transparent",
              error || showRequired
                ? "border-destructive placeholder:text-destructive"
                : "border-border placeholder:text-muted-foreground",
              boxed && "border-transparent"
            )}
          />
        </div>
        {boxed && typedDate && (
          <BracketButton onClick={onDismissDate} aria-label="not a date" className="mt-3 px-1">
            ×
          </BracketButton>
        )}
      </div>
      {listOpen && (
        // the panel grows from the bottom, so a list below the title would push it up under the pointer
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
        <p className="text-destructive font-mono text-[11px]">title is required</p>
      )}
      {error && (
        <p
          role="alert"
          className={cn("text-destructive font-mono text-[11px]", boxed && "pb-2 pl-6")}
        >
          {error}
        </p>
      )}
      {typedDate && !boxed && (
        <div className="flex items-center gap-2">
          <span className="border-primary text-foreground border px-2 py-1 font-mono text-xs">
            due {describeDeadline(typedDate.deadline)}
          </span>
          <BracketButton onClick={onDismissDate} aria-label="not a date" className="px-1">
            ×
          </BracketButton>
        </div>
      )}
    </div>
  );
}
