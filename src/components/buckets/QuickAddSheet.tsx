import { useRef, useState } from "react";
import { Drawer } from "vaul";
import { BracketButton } from "@/components/ui/BracketButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { PopoverContainerContext } from "@/components/ui/usePopover";
import { deadlineDate, withDeadlineDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";

type QuickAddSheetProps = {
  open: boolean;
  title: string;
  deadline: string;
  error: string;
  accentColor: string;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onSubmit: () => void;
  onExpand: () => void;
  onCancel: () => void;
};

export function QuickAddSheet({
  open,
  title,
  deadline,
  error,
  accentColor,
  onTitleChange,
  onDeadlineChange,
  onSubmit,
  onExpand,
  onCancel,
}: QuickAddSheetProps) {
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/30" />
        <Drawer.Content
          ref={setContent}
          aria-describedby={undefined}
          // Takes the keyboard over from the tap's stand-in input (see BucketsShell)
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            textareaRef.current?.focus();
          }}
          // Returning focus to the stand-in would bring the keyboard back up
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="border-border bg-background fixed inset-x-0 bottom-0 z-[60] flex flex-col border-t-2 outline-none"
        >
          <PopoverContainerContext.Provider value={content}>
            <div className="flex shrink-0 justify-center py-2">
              <div className="bg-border h-1 w-10 rounded-full" />
            </div>
            <Drawer.Title className="sr-only">new item</Drawer.Title>

            <div
              data-vaul-no-drag
              className="flex flex-col gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
              <textarea
                ref={(el) => {
                  textareaRef.current = el;
                  if (el) resize(el);
                }}
                value={title}
                onChange={(e) => {
                  onTitleChange(e.target.value);
                  resize(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                aria-label="title"
                placeholder="what needs doing?"
                maxLength={ITEM_TITLE_MAX_LENGTH}
                rows={1}
                // 16px: iOS zooms the page into any smaller input
                className={cn(
                  "placeholder:text-muted-foreground w-full resize-none overflow-hidden border-b bg-transparent py-1.5 text-base outline-none",
                  error ? "border-destructive" : "border-border focus:border-foreground"
                )}
              />
              {error && <p className="text-destructive -mt-1.5 font-mono text-[11px]">{error}</p>}

              <div className="flex items-center justify-between gap-4">
                <div className="w-32">
                  <DatePicker
                    value={deadlineDate(deadline)}
                    onChange={(date) => onDeadlineChange(withDeadlineDate(deadline, date))}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <BracketButton onClick={onExpand} className="py-2">
                    more
                  </BracketButton>
                  <BracketButton
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onSubmit}
                    disabled={!title.trim()}
                    style={{ color: accentColor }}
                    className="py-2"
                  >
                    add
                  </BracketButton>
                </div>
              </div>
            </div>
          </PopoverContainerContext.Provider>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
