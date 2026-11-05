import type { SVGProps } from "react";

// pixelarticons has no drag grip, so this one is drawn on the same 24px grid
export function GripIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 4h4v4H6zm8 0h4v4h-4zM6 10h4v4H6zm8 0h4v4h-4zM6 16h4v4H6zm8 0h4v4h-4z" />
    </svg>
  );
}
