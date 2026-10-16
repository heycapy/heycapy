import { useCallback, useRef, useState } from "react";
import { blankCells, type AvatarCells } from "@/lib/account/avatar";
import { AVATAR_HISTORY_LIMIT } from "./avatar-constants";

type Drawing = { cells: AvatarCells; past: AvatarCells[]; future: AvatarCells[] };

const same = (a: AvatarCells, b: AvatarCells) => a.join("") === b.join("");

function remember(past: AvatarCells[], cells: AvatarCells): AvatarCells[] {
  return [...past, cells].slice(-AVATAR_HISTORY_LIMIT);
}

// One undo step per stroke
export function useAvatarDrawing() {
  const [drawing, setDrawing] = useState<Drawing>(() => ({
    cells: blankCells(),
    past: [],
    future: [],
  }));
  const strokeStart = useRef<AvatarCells | null>(null);

  const load = useCallback((cells: AvatarCells) => {
    setDrawing({ cells, past: [], future: [] });
  }, []);

  function beginStroke() {
    strokeStart.current = drawing.cells;
  }

  function apply(change: (cells: AvatarCells) => AvatarCells) {
    setDrawing((d) => ({ ...d, cells: change(d.cells) }));
  }

  function endStroke() {
    const before = strokeStart.current;
    strokeStart.current = null;
    if (!before) return;
    setDrawing((d) =>
      same(before, d.cells) ? d : { cells: d.cells, past: remember(d.past, before), future: [] }
    );
  }

  function replace(cells: AvatarCells) {
    setDrawing((d) =>
      same(cells, d.cells) ? d : { cells, past: remember(d.past, d.cells), future: [] }
    );
  }

  function undo() {
    setDrawing((d) => {
      const previous = d.past.at(-1);
      if (!previous) return d;
      return { cells: previous, past: d.past.slice(0, -1), future: [d.cells, ...d.future] };
    });
  }

  function redo() {
    setDrawing((d) => {
      const next = d.future[0];
      if (!next) return d;
      return { cells: next, past: remember(d.past, d.cells), future: d.future.slice(1) };
    });
  }

  return {
    cells: drawing.cells,
    canUndo: drawing.past.length > 0,
    canRedo: drawing.future.length > 0,
    load,
    beginStroke,
    apply,
    endStroke,
    replace,
    undo,
    redo,
  };
}
