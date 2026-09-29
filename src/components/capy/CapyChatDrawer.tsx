import type { ReactNode } from "react";
import { Drawer } from "vaul";

type CapyChatDrawerProps = {
  open: boolean;
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
};

export function CapyChatDrawer({ open, header, children, onClose }: CapyChatDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Drawer.Content
          aria-describedby={undefined}
          className="border-border bg-background fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden border-t-2 outline-none"
        >
          <Drawer.Title className="sr-only">chat with capy</Drawer.Title>
          <div className="bg-card flex shrink-0 justify-center pt-2">
            <div className="bg-border h-1 w-10 rounded-full" />
          </div>
          {header}
          <div
            data-vaul-no-drag
            className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
