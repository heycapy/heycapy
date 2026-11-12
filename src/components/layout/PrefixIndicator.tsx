import { Kbd } from "@/components/ui/Kbd";
import { useKeybindPrefix } from "@/hooks/useKeybindPrefix";
import { useLayoutStore } from "@/store/layout";
import type { StoredKeybinds } from "@/lib/keybinds/schema";

export function PrefixIndicator({ keybinds }: { keybinds: StoredKeybinds }) {
  const active = useLayoutStore((s) => s.prefixActive);
  const { label } = useKeybindPrefix(keybinds);

  return (
    <div role="status" className="pointer-coarse:hidden">
      {active && (
        <div className="bg-card border-border text-foreground font-ui text-2xs shadow-raised fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-(--toast-radius) border px-3 py-1.5">
          <Kbd>{label}</Kbd>
          <span>waiting for a key</span>
          <span className="text-muted-foreground">esc cancels</span>
        </div>
      )}
    </div>
  );
}
