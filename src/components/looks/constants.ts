import type { CONTROL_SIZES, LOOKS } from "@/constants";
import type { IconSetId } from "@/components/ui/icon-sets";

export type Look = (typeof LOOKS)[number];
export type ControlSize = (typeof CONTROL_SIZES)[number];

// A look is a bundle of parts; components read a part, never the look's name
export type LookParts = {
  iconSet: IconSetId;
  tickBox: "pixel" | "round";
  textButton: "bracketed" | "plain";
  panelHeader: "inverted" | "plain";
  listFrame: "framed" | "bare";
  optionButton: "raised" | "flat";
  toggle: "buttons" | "switch";
  bucketTab: "underline" | "pill";
  footer: "bar" | "floating";
};

export const LOOK_PARTS: Record<Look, LookParts> = {
  original: {
    iconSet: "pixel",
    tickBox: "pixel",
    textButton: "bracketed",
    panelHeader: "inverted",
    listFrame: "framed",
    optionButton: "raised",
    toggle: "buttons",
    bucketTab: "underline",
    footer: "bar",
  },
  modern: {
    iconSet: "line",
    tickBox: "round",
    textButton: "plain",
    panelHeader: "plain",
    listFrame: "bare",
    optionButton: "flat",
    toggle: "switch",
    bucketTab: "pill",
    footer: "floating",
  },
};
