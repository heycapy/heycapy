import { useLayoutEffect, useRef } from "react";
import { ITEM_DESCRIPTION_MAX_LENGTH } from "@/constants";

const COUNTER_FROM = Math.floor(ITEM_DESCRIPTION_MAX_LENGTH * 0.9);

type InlineNotesProps = {
  value: string;
  autoFocus: boolean;
  onChange: (value: string) => void;
};

export function InlineNotes({ value, autoFocus, onChange }: InlineNotesProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !autoFocus) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
        placeholder="notes"
        aria-label="notes"
        onChange={(e) => onChange(e.target.value)}
        className="text-muted-foreground font-ui placeholder:text-muted-foreground/50 mt-1.5 block max-h-[6lh] w-full resize-none bg-transparent p-0 text-base leading-5 outline-none sm:text-xs"
      />
      {value.length >= COUNTER_FROM && (
        <span className="text-muted-foreground font-ui text-2xs block text-right">
          {value.length}/{ITEM_DESCRIPTION_MAX_LENGTH}
        </span>
      )}
    </>
  );
}
