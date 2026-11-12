"use client";

import { useState } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { useKeyCapture } from "@/hooks/useKeyCapture";
import {
  ESCAPE_KEY,
  KEYBIND_ACTIONS,
  PREFIX_CHECK,
  PREFIX_EDITING,
} from "@/lib/keybinds/constants";
import type { KeybindActionId, KeybindEditing } from "@/lib/keybinds/constants";
import { withBinding, withoutBindings } from "@/lib/keybinds/edit";
import { formatKey, mergeBindings } from "@/lib/keybinds/match";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { submitKeys } from "@/lib/keybinds/submit";
import { useIsMac } from "@/hooks/useKeybindPrefix";
import { cn } from "@/lib/utils";
import { KeyNote, KeyRow, type NoteTone } from "./KeyNote";
import { SUBHEAD } from "./settings-constants";

type RowNote = { id: KeybindActionId; tone: NoteTone; text: string };

type ShortcutRowsProps = {
  stored: StoredKeybinds;
  editing: KeybindEditing;
  setEditing: (editing: KeybindEditing) => void;
  commit: (next: StoredKeybinds) => void;
};

const REBINDABLE = KEYBIND_ACTIONS.filter((a) => a.rebindable);

function sentence(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

export function ShortcutRows({ stored, editing, setEditing, commit }: ShortcutRowsProps) {
  const [note, setNote] = useState<RowNote | null>(null);
  const isMac = useIsMac();
  const bindings = mergeBindings(stored.bindings ?? {});
  const actionId =
    editing !== null && editing !== PREFIX_EDITING && editing !== PREFIX_CHECK ? editing : null;
  const changed = stored.bindings !== undefined;

  useKeyCapture(actionId !== null, (e) => {
    if (e.key === ESCAPE_KEY) {
      setEditing(null);
      setNote(null);
      return;
    }
    if (actionId === null) return;
    const action = KEYBIND_ACTIONS.find((a) => a.id === actionId);
    const result = withBinding(stored, actionId, e);
    if (!result.ok) {
      setNote({ id: actionId, tone: "warn", text: result.error });
      return;
    }
    const next = mergeBindings(result.stored.bindings ?? {})[actionId];
    commit(result.stored);
    setEditing(null);
    setNote({
      id: actionId,
      tone: "hint",
      text: `${sentence(action?.label ?? "")} is now ${formatKey(next)}.`,
    });
  });

  function begin(id: KeybindActionId) {
    setNote(null);
    setEditing(id);
  }

  function stop() {
    setEditing(null);
    setNote(null);
  }

  function noteFor(id: KeybindActionId, label: string): { tone: NoteTone; text: string } | null {
    if (note?.id === id && (editing === id || note.tone === "hint")) return note;
    if (editing === id)
      return { tone: "hint", text: `Press the new key for ${label}. Esc to cancel.` };
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={SUBHEAD}>shortcuts</span>
      <ul aria-label="shortcuts" className="flex flex-col gap-2">
        {REBINDABLE.map((action) => {
          const recording = editing === action.id;
          const rowNote = noteFor(action.id, action.label);
          return (
            <li key={action.id} className="flex flex-col gap-1.5">
              <KeyRow
                label={action.label}
                keyLabel={formatKey(bindings[action.id])}
                active={recording}
              >
                <TextButton
                  aria-label={`${recording ? "cancel" : "record"} key for ${action.label}`}
                  onClick={() => (recording ? stop() : begin(action.id))}
                >
                  {recording ? "cancel" : "record"}
                </TextButton>
              </KeyRow>
              {rowNote && <KeyNote tone={rowNote.tone}>{rowNote.text}</KeyNote>}
            </li>
          );
        })}
        <li>
          <KeyRow label="bucket by tab order" keyLabel="1-9">
            fixed
          </KeyRow>
        </li>
        <li>
          <KeyRow label="add or save an item" keyLabel={submitKeys(isMac, true)}>
            fixed
          </KeyRow>
        </li>
        <li>
          <KeyRow label="close whatever is open" keyLabel="Esc">
            fixed
          </KeyRow>
        </li>
      </ul>
      <div className="flex justify-end pt-1">
        <TextButton
          aria-disabled={!changed}
          className={cn(!changed && "opacity-40")}
          onClick={() => changed && commit(withoutBindings(stored))}
        >
          reset all keys
        </TextButton>
      </div>
    </div>
  );
}
