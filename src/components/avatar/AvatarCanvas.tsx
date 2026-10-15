"use client";

import { useRef, type PointerEvent } from "react";
import { cellAt, cellsBetween, type AvatarCells } from "@/lib/account/avatar";
import { AVATAR_SIZE } from "@/lib/account/constants";
import { cn } from "@/lib/utils";
import { AVATAR_CANVAS } from "./avatar-constants";
import { AvatarPixels } from "./Avatar";

const GRID_LINES = Array.from(
  { length: AVATAR_SIZE - 1 },
  (_, i) => `M${i + 1} 0V${AVATAR_SIZE}M0 ${i + 1}H${AVATAR_SIZE}`
).join("");

type AvatarCanvasProps = {
  cells: AvatarCells;
  disabled?: boolean;
  onStrokeStart: (cell: number) => void;
  onStrokeMove: (cells: number[]) => void;
  onStrokeEnd: () => void;
};

export function AvatarCanvas({
  cells,
  disabled,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
}: AvatarCanvasProps) {
  const lastCell = useRef<number | null>(null);

  function cellFrom(event: PointerEvent<SVGSVGElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(AVATAR_SIZE - 1, Math.max(0, Math.floor(n)));
    return cellAt(
      clamp(((event.clientX - rect.left) / rect.width) * AVATAR_SIZE),
      clamp(((event.clientY - rect.top) / rect.height) * AVATAR_SIZE)
    );
  }

  function down(event: PointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const cell = cellFrom(event);
    lastCell.current = cell;
    onStrokeStart(cell);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const last = lastCell.current;
    if (last === null) return;
    const cell = cellFrom(event);
    if (cell === last) return;
    lastCell.current = cell;
    onStrokeMove(cellsBetween(last, cell).slice(1));
  }

  function up() {
    if (lastCell.current === null) return;
    lastCell.current = null;
    onStrokeEnd();
  }

  return (
    <svg
      viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="avatar drawing"
      data-testid="avatar-canvas"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn(
        AVATAR_CANVAS,
        "border-border cursor-crosshair touch-none border select-none",
        disabled && "cursor-default opacity-50"
      )}
    >
      <AvatarPixels cells={cells} />
      <path
        d={GRID_LINES}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1}
        className="stroke-border opacity-60"
      />
    </svg>
  );
}
