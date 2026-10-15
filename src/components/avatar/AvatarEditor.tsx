"use client";

import { useEffect, useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getAvatarAction, saveAvatarAction } from "@/app/(app)/actions";
import {
  avatarCode,
  blankCells,
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
import { LABEL } from "@/components/layout/settings-constants";
import { Avatar } from "./Avatar";
import { AvatarCanvas } from "./AvatarCanvas";
import { AvatarToolbar } from "./AvatarToolbar";
import type { AvatarTool } from "./avatar-constants";
import { useAvatarDrawing } from "./useAvatarDrawing";

export function AvatarEditor() {
  const drawing = useAvatarDrawing();
  const loadDrawing = drawing.load;
  const [saved, setSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<AvatarTool>("pencil");
  const [colour, setColour] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getAvatarAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSaved(result.avatar);
        loadDrawing(toCells(result.avatar));
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
  const changed = current !== saved;

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
    startTransition(async () => {
      const result = await saveAvatarAction(avatar);
      if (!result.ok) {
        setMessage({ text: result.error, error: true });
        return;
      }
      setSaved(result.avatar);
      setMessage({ text: result.avatar ? "saved." : "avatar removed.", error: false });
    });
  }

  function remove() {
    drawing.replace(blankCells());
    save(null);
  }

  const busy = !loaded || pending;

  return (
    <div className="flex flex-col gap-3">
      <p className={LABEL}>
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
                cells={drawing.cells}
                size={size}
                label={`preview on ${background.name}, ${size}px`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <BracketButton onClick={() => save(current)} disabled={busy || !changed}>
          {pending ? "saving..." : "save avatar"}
        </BracketButton>
        {saved !== null && (
          <BracketButton variant="destructive" onClick={remove} disabled={busy}>
            remove avatar
          </BracketButton>
        )}
      </div>

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
