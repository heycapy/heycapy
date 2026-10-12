import { BETA_FEATURES, type BetaFeature } from "@/constants";
import { cn } from "@/lib/utils";

export function BetaTag({ feature, className }: { feature: BetaFeature; className?: string }) {
  if (!BETA_FEATURES.includes(feature)) return null;
  return (
    <span
      aria-hidden
      data-beta-tag
      className={cn("ml-1.5 font-mono text-[10px] opacity-60", className)}
    >
      [beta]
    </span>
  );
}
