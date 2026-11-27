import type { ItemId } from "@/types/ids";
import { notify } from "@/components/ui/notify";
import { restoreItemAction } from "@/app/(app)/actions";
import { undoQueuedDelete } from "@/hooks/useSync";
import { UNDO_DELETE_MS } from "./constants";

export function offerUndoDelete(itemId: ItemId, title: string, onRestored: () => Promise<void>) {
  notify.info(`deleted "${title}"`, {
    icon: "trash",
    countdown: true,
    duration: UNDO_DELETE_MS,
    action: {
      label: "undo",
      onClick: () => {
        void (async () => {
          // Still on this device, so it never happened; otherwise the server has it in the trash
          if (await undoQueuedDelete(itemId)) return;
          const result = await restoreItemAction(itemId);
          if (result.ok) await onRestored();
          else notify.error(result.error);
        })();
      },
    },
  });
}
