import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";

export function CharCount({ length, max }: { length: number; max: number }) {
  if (length === 0) return null;
  return (
    <p
      className={cn(
        "mt-0.5 text-right font-mono text-[11px] transition-colors",
        charCountColor(length, max)
      )}
    >
      {length}/{max}
    </p>
  );
}
