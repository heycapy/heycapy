import { avatarRuns, type AvatarCells } from "@/lib/account/avatar";
import { AVATAR_SIZE } from "@/lib/account/constants";
import { cn } from "@/lib/utils";

type AvatarProps = {
  cells: AvatarCells;
  size: number;
  label?: string;
  className?: string;
};

export function AvatarPixels({ cells }: { cells: AvatarCells }) {
  return avatarRuns(cells).map((run) => (
    <rect
      key={`${run.x}-${run.y}`}
      x={run.x}
      y={run.y}
      width={run.width}
      height={1}
      className={run.fill}
    />
  ));
}

export function Avatar({ cells, size, label, className }: AvatarProps) {
  return (
    <svg
      viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <AvatarPixels cells={cells} />
    </svg>
  );
}
