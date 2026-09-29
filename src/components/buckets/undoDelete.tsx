import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BracketButton } from "@/components/ui/BracketButton";
import { restoreItemAction } from "@/app/(app)/actions";
import { UNDO_DELETE_MS } from "./constants";

function UndoToast({
  id,
  title,
  onUndo,
}: {
  id: string | number;
  title: string;
  onUndo: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(UNDO_DELETE_MS / 1000);

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    const close = setTimeout(() => toast.dismiss(id), UNDO_DELETE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(close);
    };
  }, [id]);

  return (
    <div className="bg-background border-border text-foreground relative w-[356px] max-w-[calc(100vw-2rem)] overflow-hidden border-2 font-mono text-xs">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate">deleted &quot;{title}&quot;</span>
        <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">
          {Math.max(secondsLeft, 0)}s
        </span>
        <BracketButton
          onClick={() => {
            toast.dismiss(id);
            onUndo();
          }}
        >
          undo
        </BracketButton>
        <BracketButton onClick={() => toast.dismiss(id)} aria-label="dismiss">
          x
        </BracketButton>
      </div>
      <div
        aria-hidden
        className="bg-muted-foreground/50 h-0.5 origin-left"
        style={{ animation: `countdown ${UNDO_DELETE_MS}ms linear forwards` }}
      />
    </div>
  );
}

export function offerUndoDelete(itemId: number, title: string, onRestored: () => Promise<void>) {
  toast.custom(
    (id) => (
      <UndoToast
        id={id}
        title={title}
        onUndo={() => {
          void restoreItemAction(itemId).then(async (result) => {
            if (result.ok) await onRestored();
            else toast.error(result.error);
          });
        }}
      />
    ),
    { duration: Infinity, unstyled: true }
  );
}
