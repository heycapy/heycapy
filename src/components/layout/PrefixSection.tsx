"use client";

import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { TextButton } from "@/components/ui/TextButton";
import { useKeyCapture } from "@/hooks/useKeyCapture";
import { useIsMac, useKeybindPrefix } from "@/hooks/useKeybindPrefix";
import { clashesFor, describeClash, suggestedPrefixes } from "@/lib/keybinds/clashes";
import { ESCAPE_KEY, PREFIX_CHECK, PREFIX_EDITING, PREFIX_TEST_MS } from "@/lib/keybinds/constants";
import type { KeybindEditing, Prefix } from "@/lib/keybinds/constants";
import { withPrefix } from "@/lib/keybinds/edit";
import {
  defaultPrefix,
  formatHeld,
  formatPrefix,
  matchesPrefix,
  prefixFromEvent,
  samePrefix,
} from "@/lib/keybinds/match";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { cn } from "@/lib/utils";
import { InlineButton, KeyNote, KeyRow, type NoteTone } from "./KeyNote";
import { SUBHEAD } from "./settings-constants";

type Note = { tone: NoteTone; text: string };

type PrefixSectionProps = {
  stored: StoredKeybinds;
  editing: KeybindEditing;
  setEditing: (editing: KeybindEditing) => void;
  commit: (next: StoredKeybinds) => void;
};

export function PrefixSection({ stored, editing, setEditing, commit }: PrefixSectionProps) {
  const { prefix, label } = useKeybindPrefix(stored);
  const isMac = useIsMac();
  const recording = editing === PREFIX_EDITING;
  const checking = editing === PREFIX_CHECK;
  const [pending, setPending] = useState<Prefix | null>(null);
  const [picked, setPicked] = useState(false);
  const [held, setHeld] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wasRecording = useRef(false);
  const fallback = defaultPrefix(isMac);
  const fallbackLabel = formatPrefix(fallback, isMac);

  useKeyCapture(
    recording || checking,
    (e) => {
      if (e.key === ESCAPE_KEY) return stop();
      if (checking) {
        if (!matchesPrefix(e, prefix)) return;
        setEditing(null);
        setNote({ tone: "hint", text: `${label} works. Your browser let it through.` });
        return;
      }
      const next = prefixFromEvent(e);
      if (next) {
        setPending(next);
        setPicked(false);
        setHeld("");
        setNote(null);
        return;
      }
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      setNote({
        tone: "warn",
        text: hasModifier
          ? "Use a letter, number or symbol key."
          : "Hold Ctrl, Cmd or Alt first, then press the key.",
      });
    },
    { onModifier: (e) => setHeld(formatHeld(e, isMac)), activateButtons: true }
  );

  useEffect(() => {
    if (!checking) return;
    const timer = setTimeout(() => {
      setEditing(null);
      setNote({
        tone: "warn",
        text: `${label} didn't get through. Your browser or system uses it. Pick a different prefix.`,
      });
    }, PREFIX_TEST_MS);
    return () => clearTimeout(timer);
  }, [checking, label, setEditing]);

  useEffect(() => {
    if (recording) boxRef.current?.querySelector("button")?.focus();
    else if (wasRecording.current) changeRef.current?.focus();
    wasRecording.current = recording;
  }, [recording]);

  function reset() {
    setPending(null);
    setPicked(false);
    setHeld("");
    setNote(null);
  }

  function stop() {
    reset();
    setEditing(null);
  }

  function begin(next: KeybindEditing) {
    reset();
    setEditing(next);
  }

  function save() {
    if (!pending) return;
    const savedLabel = formatPrefix(pending, isMac);
    commit(withPrefix(stored, samePrefix(pending, fallback) ? null : pending));
    reset();
    setEditing(null);
    setNote({ tone: "hint", text: `Saved. ${savedLabel} is your prefix now.` });
  }

  if (recording) {
    const pendingClashes = pending && !picked ? clashesFor(pending, isMac) : [];
    const pendingLabel = pending ? formatPrefix(pending, isMac) : "";
    const message: Note = note ?? pendingMessage(pending, picked, pendingLabel, pendingClashes);
    const shown = held || pendingLabel || label;
    return (
      <div role="group" aria-label="new prefix" className="flex flex-col gap-2">
        <div
          ref={boxRef}
          className="rounded-control bg-card flex flex-col gap-3 border border-(--button-accent) p-3"
        >
          <Suggestions
            options={suggestedPrefixes(prefix, isMac)}
            picked={picked ? pending : null}
            isMac={isMac}
            onPick={(option) => {
              setPending(option);
              setPicked(true);
              setHeld("");
              setNote(null);
            }}
          />
          <span className={SUBHEAD}>or press your own</span>
          <div
            className={cn(
              "rounded-control font-ui border px-2 py-3 text-center text-sm tracking-wide",
              pending
                ? "border-(--button-accent) text-(--button-accent)"
                : "border-border text-muted-foreground border-dashed"
            )}
          >
            {shown}
          </div>
          <KeyNote tone={message.tone}>{message.text}</KeyNote>
          <div className="flex justify-end gap-4">
            <TextButton
              variant="primary"
              aria-label="save prefix"
              onClick={save}
              disabled={!pending}
            >
              save
            </TextButton>
            <TextButton aria-label="cancel prefix" onClick={stop}>
              cancel
            </TextButton>
          </div>
        </div>
      </div>
    );
  }

  const clashes = clashesFor(prefix, isMac);
  return (
    <div className="flex flex-col gap-2">
      <KeyRow label="prefix" keyLabel={label}>
        <TextButton
          ref={changeRef}
          aria-label="change prefix"
          onClick={() => begin(PREFIX_EDITING)}
        >
          change
        </TextButton>
      </KeyRow>
      {checking && <KeyNote>Press {label} now. Esc to cancel.</KeyNote>}
      {note && !checking && <KeyNote tone={note.tone}>{note.text}</KeyNote>}
      {clashes.length > 0 && !checking && (
        <KeyNote tone="warn">
          {clashes.map((c) => describeClash(c, label)).join(" ")}{" "}
          <InlineButton onClick={() => begin(PREFIX_CHECK)}>check it</InlineButton>
        </KeyNote>
      )}
      {stored.prefix && !checking && (
        <p className="text-muted-foreground font-ui text-2xs">
          Using {label} ·{" "}
          <span className="text-(--button-accent)">
            <InlineButton onClick={() => commit(withPrefix(stored, null))}>
              use {fallbackLabel} again
            </InlineButton>
          </span>
        </p>
      )}
    </div>
  );
}

function pendingMessage(
  pending: Prefix | null,
  picked: boolean,
  label: string,
  clashes: ReturnType<typeof clashesFor>
): Note {
  if (!pending) {
    return {
      tone: "hint",
      text: "Pick one above, or hold Ctrl, Cmd or Alt plus a letter, number or symbol. Esc to cancel.",
    };
  }
  if (picked)
    return { tone: "hint", text: `${label} has no known clash. Save it, or press something else.` };
  if (clashes.length > 0) {
    return {
      tone: "warn",
      text: `${clashes.map((c) => describeClash(c, label)).join(" ")} Save it anyway, or press something else.`,
    };
  }
  return { tone: "hint", text: `${label} works. Save it, or press something else.` };
}

type SuggestionsProps = {
  options: Prefix[];
  picked: Prefix | null;
  isMac: boolean;
  onPick: (option: Prefix) => void;
};

function Suggestions({ options, picked, isMac, onPick }: SuggestionsProps) {
  if (options.length === 0) return null;
  return (
    <>
      <span className={SUBHEAD}>suggested, no known clash</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = picked !== null && samePrefix(picked, option);
          return (
            <button
              key={formatPrefix(option, isMac)}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(option)}
              className="rounded-control focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Kbd
                className={cn(
                  "px-2 py-1 text-xs transition-colors hover:border-(--button-accent)",
                  active && "text-background border-(--button-accent) bg-(--button-accent)"
                )}
              >
                {formatPrefix(option, isMac)}
              </Kbd>
            </button>
          );
        })}
      </div>
    </>
  );
}
