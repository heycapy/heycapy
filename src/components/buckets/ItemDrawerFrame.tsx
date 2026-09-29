import { useState } from "react";
import { Drawer } from "vaul";
import { BracketButton } from "@/components/ui/BracketButton";
import { PopoverContainerContext } from "@/components/ui/usePopover";
import type { ItemFrameProps } from "./ItemDialogFrame";

export function ItemDrawerFrame({
  open,
  heading,
  scrollBodyRef,
  footer,
  children,
  onCancel,
}: ItemFrameProps) {
  const [content, setContent] = useState<HTMLDivElement | null>(null);

  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[55] bg-black/45" />
        <Drawer.Content
          ref={setContent}
          aria-describedby={undefined}
          className="border-border bg-background fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col border-t-2 outline-none"
        >
          <PopoverContainerContext.Provider value={content}>
            <div className="flex shrink-0 justify-center py-2">
              <div className="bg-border h-1 w-10 rounded-full" />
            </div>

            <div className="bg-foreground text-background flex shrink-0 items-center justify-between px-3 py-1.5">
              <Drawer.Title className="font-pixel text-xs">{heading}</Drawer.Title>
              <BracketButton variant="inverted" onClick={onCancel}>
                x
              </BracketButton>
            </div>

            <div
              ref={scrollBodyRef}
              data-vaul-no-drag
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
            >
              {children}
            </div>

            <div
              data-vaul-no-drag
              className="border-border flex shrink-0 items-center justify-between border-t px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
            >
              {footer}
            </div>
          </PopoverContainerContext.Provider>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
