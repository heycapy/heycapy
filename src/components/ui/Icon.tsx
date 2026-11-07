import type { SVGProps } from "react";
import { PIXEL_ICON_SET, type IconName } from "./icons";

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  const Svg = PIXEL_ICON_SET.icons[name];
  return (
    <Svg
      width={PIXEL_ICON_SET.size}
      height={PIXEL_ICON_SET.size}
      {...PIXEL_ICON_SET.svg}
      aria-hidden
      {...props}
    />
  );
}
