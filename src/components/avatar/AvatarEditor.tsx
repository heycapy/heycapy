"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getAvatarAction, saveAvatarAction } from "@/app/(app)/actions";
import {
  avatarCode,
  avatarFor,
  blankCells,
  defaultAvatar,
  fill,
  paint,
  toAvatar,
  toCells,
  type AvatarCells,
} from "@/lib/account/avatar";
import {
  AVATAR_DISPLAY_SIZES,
  AVATAR_EMPTY,
  AVATAR_PREVIEW_BACKGROUNDS,
} from "@/lib/account/constants";
import { cn } from "@/lib/utils";
import { LABEL, MUTED } from "@/components/layout/settings-constants";
import { Avatar } from "./Avatar";
import { AvatarCanvas } from "./AvatarCanvas";
import { AvatarPresets } from "./AvatarPresets";
import { AvatarToolbar } from "./AvatarToolbar";
import type { AvatarTool } from "./avatar-constants";
import { useAvatarDrawing } from "./useAvatarDrawing";

export type AvatarDraft = { avatar: string | null } | null;

type AvatarEditorProps = {
  draft: AvatarDraft;
  onDraft: (draft: AvatarDraft) => void;
};

export function AvatarEditor({ draft, onDraft }: AvatarEditorProps) {
  const drawing = useAvatarDrawing();
  const startDraft = useRef(draft);
  const loadDrawing = drawing.load;
  const [saved, setSaved] = useState<string | null>(null);
  const [generated, setGenerated] = useState<AvatarCells>(blankCells);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<AvatarTool>("pencil");
  const [colour, setColour] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getAvatarAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSaved(result.avatar);
        setGenerated(defaultAvatar(result.userId));
        const unsaved = startDraft.current;
        loadDrawing(unsaved ? toCells(unsaved.avatar) : avatarFor(result.avatar, result.userId));
      } else {
        setMessage({ text: result.error, error: true });
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadDrawing]);

  const current = toAvatar(drawing.cells);
  // What others see now: the saved drawing, or the generated one for someone who never drew
  const shown = saved ?? generated.join("");
  const changed = drawing.cells.join("") !== shown;
  const empty = current === null;
  const showingGenerated = saved === null && !changed;
  const pendingAvatar = loaded && changed ? current : undefined;

  useEffect(() => {
    onDraft(pendingAvatar === undefined ? null : { avatar: pendingAvatar });
  }, [pendingAvatar, onDraft]);

  function strokeAt(cells: AvatarCells, indexes: number[]): AvatarCells {
    if (tool === "fill") return cells;
    const code = tool === "eraser" ? AVATAR_EMPTY : avatarCode(colour);
    return paint(cells, indexes, code, mirror);
  }

  function startStroke(cell: number) {
    setMessage(null);
    drawing.beginStroke();
    drawing.apply((cells) =>
      tool === "fill" ? fill(cells, cell, avatarCode(colour), mirror) : strokeAt(cells, [cell])
    );
  }

  function pickColour(index: number) {
    setColour(index);
    if (tool === "eraser") setTool("pencil");
  }

  function save(avatar: string | null) {
    setMessage(null);
    setConfirmingRemove(false);
    startTransition(async () => {
      const result = await saveAvatarAction(avatar);
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setSaved(result.avatar);
      if (result.avatar) {
        setMessage({ text: "saved.", error: false });
        return;
      }
      drawing.replace(generated);
      if (saved !== null) {
        setMessage({ text: "removed. people now see the one made for you.", error: false });
      }
    });
  }

  const busy = !loaded || pending;

  return (
    <div className="flex flex-col gap-3">
      <p className={MUTED}>
        draw the picture people see next to your name in shared buckets. empty squares are
        see-through, so check it on both backgrounds below.
      </p>

      <div className="flex flex-col gap-4">
        <AvatarCanvas
          cells={drawing.cells}
          disabled={busy}
          onStrokeStart={startStroke}
          onStrokeMove={(indexes) => drawing.apply((cells) => strokeAt(cells, indexes))}
          onStrokeEnd={drawing.endStroke}
        />
        <AvatarToolbar
          tool={tool}
          colour={colour}
          mirror={mirror}
          canUndo={drawing.canUndo}
          canRedo={drawing.canRedo}
          disabled={busy}
          onTool={setTool}
          onColour={pickColour}
          onMirror={setMirror}
          onUndo={drawing.undo}
          onRedo={drawing.redo}
          onClear={() => drawing.replace(blankCells())}
        />
        <AvatarPresets
          disabled={busy}
          onPick={(cells) => {
            setMessage(null);
            drawing.replace(cells);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2" data-testid="avatar-previews">
        {AVATAR_PREVIEW_BACKGROUNDS.map((background) => (
          <div
            key={background.name}
            className={cn("border-border flex items-end gap-3 border p-2", background.className)}
          >
            {AVATAR_DISPLAY_SIZES.map((size) => (
              <Avatar
                key={size}
                cells={empty ? generated : drawing.cells}
                size={size}
                label={`preview on ${background.name}, ${size}px`}
              />
            ))}
          </div>
        ))}
      </div>

      {loaded && (empty || showingGenerated) && (
        <p className={MUTED} data-testid="avatar-hint">
          {empty
            ? "an empty avatar can't be saved. people will see the one made for you."
            : "this one was made for you. draw over it, or clear it to start fresh."}
        </p>
      )}
      <div>
        <BracketButton onClick={() => save(current)} disabled={busy || !changed}>
          {pending ? "saving..." : empty ? "use the one made for me" : "save avatar"}
        </BracketButton>
      </div>
      {saved !== null &&
        (confirmingRemove ? (
          <div className="flex flex-col gap-2">
            <p className={MUTED}>remove your avatar? people will see the one made for you.</p>
            <div className="flex gap-3">
              <BracketButton variant="destructive" onClick={() => save(null)} disabled={busy}>
                confirm
              </BracketButton>
              <BracketButton onClick={() => setConfirmingRemove(false)} disabled={busy}>
                cancel
              </BracketButton>
            </div>
          </div>
        ) : (
          <div>
            <BracketButton
              variant="destructive"
              onClick={() => {
                setMessage(null);
                setConfirmingRemove(true);
              }}
              disabled={busy}
            >
              remove avatar
            </BracketButton>
          </div>
        ))}

      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={cn("font-mono text-xs", message.error ? "text-destructive" : LABEL)}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
