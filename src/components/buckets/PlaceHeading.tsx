import { Menu } from "pixelarticons/react/Menu.js";
import type { ReactNode } from "react";
import { PixelIcon } from "@/components/ui/PixelIcon";

type PlaceHeadingProps = {
  name: string;
  onOpenPlaces: () => void;
  children: ReactNode;
};

// The icon and the name are one button: either opens the drawer of buckets
export function PlaceHeading({ name, onOpenPlaces, children }: PlaceHeadingProps) {
  return (
    <button
      type="button"
      onClick={onOpenPlaces}
      aria-haspopup="dialog"
      aria-label={`buckets: ${name}`}
      className="group/place -my-1 -ml-1 flex min-w-0 items-center gap-2 overflow-hidden py-1 pr-2 pl-1 text-left"
    >
      <span className="text-muted-foreground group-hover/place:text-foreground flex shrink-0 items-center font-mono text-xs transition-colors">
        <span className="opacity-50">[</span>
        <PixelIcon icon={Menu} />
        <span className="opacity-50">]</span>
      </span>
      {children}
    </button>
  );
}
