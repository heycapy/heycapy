import { BUCKET_PALETTE } from "./constants";

export function bucketColor(colorIndex: number): string {
  return BUCKET_PALETTE[Math.max(colorIndex, 0) % BUCKET_PALETTE.length];
}
