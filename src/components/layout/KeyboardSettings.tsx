"use client";

import { useEffect, useState } from "react";
import { saveKeybindsAction } from "@/app/(app)/actions";
import { Kbd } from "@/components/ui/Kbd";
import { notify } from "@/components/ui/notify";
import { TextButton } from "@/components/ui/TextButton";
import { Toggle } from "@/components/ui/Toggle";
import { useKeyCapture } from "@/hooks/useKeyCapture";
import { useIsMac, useKeybindPrefix } from "@/hooks/useKeybindPrefix";
import { clashesFor } from "@/lib/keybinds/clashes";
import { ESCAPE_KEY, KEYBIND_ACTIONS, PREFIX_TEST_MS } from "@/lib/keybinds/constants";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import { withBinding, withHints, withoutBindings, withPrefix } from "@/lib/keybinds/edit";
import { formatKey, matchesPrefix, mergeBindings, prefixFromEvent } from "@/lib/keybinds/match";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { cn } from "@/lib/utils";
import { useStoredKeybinds } from "@/components/providers/KeybindsProvider";
import { HINT, LABEL } from "./settings-constants";
import { useSaveSetting } from "./useSaveSetting";

type Editing = "prefix" | KeybindActionId | null;
type PrefixTest = "waiting" | "received" | "missed" | null;

export function KeyboardSettings() {
  const stored = useStoredKeybinds();
  const { prefix, label } = useKeybindPrefix(stored);
  const isMac = useIsMac();
  const { pending, save } = useSaveSetting();
  const [editing, setEditing] = useState<Editing>(null);
  const [test, setTest] = useState<PrefixTest>(null);
  const [listOpen, setListOpen] = useState(false);
  const bindings = mergeBindings(stored.bindings ?? {});
  const clashes = clashesFor(prefix, isMac);
  const rebound = stored.bindings !== undefined;

  // buttons stay enabled while saving: a disabled one drops focus, and Escape then can't close tweaks
  function commit(next: StoredKeybinds) {
    setEditing(null);
    if (!pending) save(saveKeybindsAction, next);
  }

  useKeyCapture(editing !== null || test === "waiting", (e) => {
    if (e.key === ESCAPE_KEY) {
      setEditing(null);
      setTest(null);
      return;
    }
    if (test === "waiting") {
      if (matchesPrefix(e, prefix)) setTest("received");
      return;
    }
    if (editing === "prefix") {
      const next = prefixFromEvent(e);
      if (next) commit(withPrefix(stored, next));
      else notify.error("The prefix needs Ctrl, Cmd or Alt held with a key");
      return;
    }
    if (!editing) return;
    const result = withBinding(stored, editing, e);
    if (result.ok) commit(result.stored);
    else notify.error(result.error);
  });

  useEffect(() => {
    if (test !== "waiting") return;
    const timer = setTimeout(() => setTest("missed"), PREFIX_TEST_MS);
    return () => clearTimeout(timer);
  }, [test]);

  const status = prefixStatus(editing, test, label);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className={LABEL}>keybindings</label>
        <span className={HINT}>
          press the prefix, then one key. {label} then ? lists them all, esc closes anything open
        </span>
      </div>

      <section aria-label="prefix" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground font-ui text-xs">prefix</span>
          <Kbd className={cn(editing === "prefix" && "text-muted-foreground animate-pulse")}>
            {editing === "prefix" ? "press keys..." : label}
          </Kbd>
        </div>
        <div className="flex items-center gap-3">
          <TextButton aria-label="change prefix" onClick={() => setEditing("prefix")}>
            change
          </TextButton>
          <TextButton aria-label="test prefix" onClick={() => setTest("waiting")}>
            test
          </TextButton>
          {stored.prefix && (
            <TextButton aria-label="reset prefix" onClick={() => commit(withPrefix(stored, null))}>
              reset
            </TextButton>
          )}
        </div>
        {status && (
          <p role="status" className={cn(HINT, status.warn && "text-warning")}>
            {status.text}
          </p>
        )}
        {clashes.length > 0 && (
          <ul className="text-warning font-ui text-2xs flex flex-col gap-0.5 leading-tight">
            {clashes.map((c) => (
              <li key={c.source}>
                {label} {c.action} in {c.source}, so the page may never see it. use test to check
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className={LABEL}>key hints on buttons</label>
          <Toggle
            label="key hints on buttons"
            value={stored.hints === true}
            onChange={(value) => commit(withHints(stored, value))}
          />
        </div>
        <span className={HINT}>
          shows the key on the buttons it works for, not on touch screens
        </span>
      </div>

      <section aria-label="keys" className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <TextButton onClick={() => setListOpen((open) => !open)} aria-expanded={listOpen}>
            {listOpen ? "hide keys" : "change keys"}
          </TextButton>
          {rebound && (
            <TextButton onClick={() => commit(withoutBindings(stored))}>reset keys</TextButton>
          )}
        </div>
        {listOpen && (
          <ul className="flex flex-col gap-1.5">
            {KEYBIND_ACTIONS.filter((a) => a.rebindable).map((action) => (
              <li key={action.id} className="flex items-center justify-between gap-3">
                <span className="text-foreground font-ui text-xs">{action.label}</span>
                <span className="flex items-center gap-3">
                  <Kbd
                    className={cn(editing === action.id && "text-muted-foreground animate-pulse")}
                  >
                    {editing === action.id ? "press a key..." : formatKey(bindings[action.id])}
                  </Kbd>
                  <TextButton
                    aria-label={`change key for ${action.label}`}
                    onClick={() => setEditing(action.id)}
                  >
                    change
                  </TextButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function prefixStatus(
  editing: Editing,
  test: PrefixTest,
  label: string
): { text: string; warn: boolean } | null {
  if (editing === "prefix") {
    return { text: "hold Ctrl, Cmd or Alt and press a key. esc cancels", warn: false };
  }
  if (test === "waiting") return { text: `press ${label} now. esc cancels`, warn: false };
  if (test === "received") return { text: `${label} reached the page, it will work`, warn: false };
  if (test === "missed") {
    return {
      text: `${label} never reached the page, the browser or system took it. pick another prefix`,
      warn: true,
    };
  }
  return null;
}
