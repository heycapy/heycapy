import { BUCKET_NUMBERS, KEYBIND_ACTIONS } from "./constants";
import { formatKey } from "./match";
import { submitKeys } from "./submit";
import type { KeyBindings } from "./match";

export type CheatSheetRow = {
  label: string;
  key: string;
};

const BUCKET_ACTION_ID = /^bucket-\d$/;

export function cheatSheetRows(bindings: KeyBindings, isMac = false): CheatSheetRow[] {
  const rows: CheatSheetRow[] = [];
  for (const action of KEYBIND_ACTIONS) {
    if (!BUCKET_ACTION_ID.test(action.id)) {
      rows.push({ label: action.label, key: formatKey(bindings[action.id]) });
      continue;
    }
    if (action.id === "bucket-1") {
      const first = BUCKET_NUMBERS[0];
      const last = BUCKET_NUMBERS[BUCKET_NUMBERS.length - 1];
      rows.push({ label: "bucket by tab order", key: `${first}-${last}` });
    }
  }
  rows.push({ label: "add or save an item", key: submitKeys(isMac, true) });
  rows.push({ label: "close whatever is open", key: "Esc" });
  return rows;
}
