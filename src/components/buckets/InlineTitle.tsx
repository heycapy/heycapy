import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";

type InlineTitleProps = {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
};

export function InlineTitle({ value, onChange, onEnter }: InlineTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    onEnter();
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={ITEM_TITLE_MAX_LENGTH}
      aria-label="title"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="block max-h-[4lh] w-full resize-none bg-transparent p-0 text-base outline-none sm:text-sm"
    />
  );
}
