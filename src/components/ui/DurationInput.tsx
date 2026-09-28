import { cn } from "@/lib/utils";
import { durationPreview } from "@/lib/duration";

const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

type DurationInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function DurationInput({
  value,
  onChange,
  placeholder = "e.g. 7 days, 2 weeks",
  disabled,
  className,
}: DurationInputProps) {
  const preview = durationPreview(value);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={INPUT}
      />
      {value && preview.text && (
        <span
          className={cn(
            "font-mono text-[10px]",
            preview.valid ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {preview.text}
        </span>
      )}
    </div>
  );
}
