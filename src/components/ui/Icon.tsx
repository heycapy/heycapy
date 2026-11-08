"use client";

import type { SVGProps } from "react";
import { useLookParts } from "@/components/looks/LookProvider";
import { ICON_SETS } from "./icon-sets";
import type { IconName } from "./icons";

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  const set = ICON_SETS[useLookParts().iconSet];
  const Svg = set.icons[name];
  return <Svg width={set.size} height={set.size} {...set.svg} aria-hidden {...props} />;
}
