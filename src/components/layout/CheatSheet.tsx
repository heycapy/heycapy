import { Kbd } from "@/components/ui/Kbd";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { useKeybindPrefix } from "@/hooks/useKeybindPrefix";
import { cheatSheetRows } from "@/lib/keybinds/cheat-sheet";
import { mergeBindings } from "@/lib/keybinds/match";
import { useStoredKeybinds } from "@/components/providers/KeybindsProvider";
import { useLayoutStore } from "@/store/layout";

export function CheatSheet() {
  const keybinds = useStoredKeybinds();
  const open = useLayoutStore((s) => s.cheatSheetOpen);
  const setOpen = useLayoutStore((s) => s.setCheatSheetOpen);
  const { label } = useKeybindPrefix(keybinds);
  const rows = cheatSheetRows(mergeBindings(keybinds.bindings ?? {}));

  return (
    <Modal open={open} onClose={() => setOpen(false)} label="keyboard shortcuts">
      <div className="bg-background border-border rounded-panel border-frame flex max-h-[80dvh] w-full flex-col">
        <ModalHeader title="keyboard shortcuts" onClose={() => setOpen(false)} />
        <p className="text-muted-foreground font-ui text-2xs flex flex-wrap items-center gap-1.5 px-4 pt-3">
          press <Kbd>{label}</Kbd> then a key, Esc needs no prefix
        </p>
        <ul className="flex flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 py-3">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-foreground font-ui text-xs">{row.label}</span>
              <Kbd>{row.key}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
