import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";
import {
  findMention,
  mentionOptions,
  removeMention,
  type MentionMember,
  type MentionOption,
} from "@/lib/items/mention";
import { MentionList } from "./MentionList";

type InlineTitleProps = {
  value: string;
  autoFocus: boolean;
  mention?: { members: MentionMember[]; onPick: (userId: number | null) => void };
  onChange: (value: string) => void;
  onEnter: () => void;
};

export function InlineTitle({ value, autoFocus, mention, onChange, onEnter }: InlineTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caretAfterPick = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [closedOn, setClosedOn] = useState<string | null>(null);

  const found = mention ? findMention(value, caret) : null;
  const options = found && mention ? mentionOptions(mention.members, found.query) : [];
  const listOpen = found !== null && options.length > 0 && closedOn !== value;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !autoFocus) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
    setCaret(el.value.length);
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (caretAfterPick.current === null) return;
    el.setSelectionRange(caretAfterPick.current, caretAfterPick.current);
    caretAfterPick.current = null;
  }, [value]);

  function pick(option: MentionOption) {
    if (!found || !mention) return;
    const next = removeMention(value, found);
    caretAfterPick.current = next.caret;
    setCaret(next.caret);
    onChange(next.text);
    mention.onPick(option.userId);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
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
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    onEnter();
  }

  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={ITEM_TITLE_MAX_LENGTH}
        aria-label="title"
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setHighlighted(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className="block max-h-[4lh] w-full resize-none bg-transparent p-0 text-base outline-none sm:text-sm"
      />
      {listOpen && (
        <div className="pt-2">
          <MentionList
            options={options}
            highlighted={Math.min(highlighted, options.length - 1)}
            onPick={pick}
            onHover={setHighlighted}
          />
        </div>
      )}
    </>
  );
}
