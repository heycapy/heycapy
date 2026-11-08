import type { ComponentType, SVGProps } from "react";
import type { ICON_NAMES } from "./constants";

export type IconName = (typeof ICON_NAMES)[number];

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type IconSet = {
  size: number;
  svg: SVGProps<SVGSVGElement>;
  icons: Record<IconName, IconComponent>;
};
