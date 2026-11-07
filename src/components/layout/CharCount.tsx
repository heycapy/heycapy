import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";

export function CharCount({ length, max }: { length: number; max: number }) {
  if (length === 0) return null;
  return (
    <p
      className={cn(
        "font-ui text-2xs mt-0.5 text-right transition-colors",
        charCountColor(length, max)
      )}
    >
      {length}/{max}
    </p>
  );
}
