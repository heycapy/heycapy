import type { ComponentType, SVGProps } from "react";
import { PIXEL_ICON_SIZE } from "./constants";

export type PixelIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type PixelIconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  icon: PixelIconComponent;
};

export function PixelIcon({ icon: Icon, ...props }: PixelIconProps) {
  return (
    <Icon
      width={PIXEL_ICON_SIZE}
      height={PIXEL_ICON_SIZE}
      shapeRendering="crispEdges"
      aria-hidden
      {...props}
    />
  );
}
