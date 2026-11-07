import { LINE_ICON_SET } from "./line";
import { PIXEL_ICON_SET } from "./pixel";

export const ICON_SETS = {
  pixel: PIXEL_ICON_SET,
  line: LINE_ICON_SET,
};

export type IconSetId = keyof typeof ICON_SETS;
