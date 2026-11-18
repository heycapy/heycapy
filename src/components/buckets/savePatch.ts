import { patchItemAction } from "@/app/(app)/actions";
import { notify } from "@/components/ui/notify";
import type { ItemPatch } from "@/lib/items/edit-draft";
import type { ListItem } from "@/lib/reminders/status";

// The list already shows the change; this saves it and puts the server's copy back, which also
// undoes the change when the save is refused
export async function saveItemPatch(
  item: ListItem,
  patch: ItemPatch,
  refetch: () => Promise<void>
): Promise<void> {
  const result = await patchItemAction(item.id, patch);
  if (!result.ok) {
    notify.error(result.error, {
      action: { label: "retry", onClick: () => void saveItemPatch(item, patch, refetch) },
    });
  }
  await refetch();
}
