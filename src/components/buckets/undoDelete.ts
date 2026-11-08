import { notify } from "@/components/ui/notify";
import { restoreItemAction } from "@/app/(app)/actions";
import { UNDO_DELETE_MS } from "./constants";

export function offerUndoDelete(itemId: number, title: string, onRestored: () => Promise<void>) {
  notify.info(`deleted "${title}"`, {
    icon: "trash",
    countdown: true,
    duration: UNDO_DELETE_MS,
    action: {
      label: "undo",
      onClick: () => {
        void restoreItemAction(itemId).then(async (result) => {
          if (result.ok) await onRestored();
          else notify.error(result.error);
        });
      },
    },
  });
}
