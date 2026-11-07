import type { LOOKS } from "@/constants";
import type { IconSetId } from "@/components/ui/icon-sets";

export type Look = (typeof LOOKS)[number];

// A look is a bundle of parts; components read a part, never the look's name
export type LookParts = {
  iconSet: IconSetId;
};

export const LOOK_PARTS: Record<Look, LookParts> = {
  original: { iconSet: "pixel" },
  modern: { iconSet: "line" },
};
