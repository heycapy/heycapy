import { ChevronDown } from "lucide-react";

export type BucketChoice = {
  options: { id: number; name: string; color: string }[];
  value: number;
  onChange: (id: number) => void;
};

// A native select: stays one line with any number of buckets, and phones show their own picker
export function ItemBucketField({
  choice,
  disabled,
}: {
  choice: BucketChoice;
  disabled?: boolean;
}) {
  const selected = choice.options.find((b) => b.id === choice.value);

  return (
    <div className="flex flex-col gap-1.5 pb-5">
      <label htmlFor="item-bucket" className="text-muted-foreground font-mono text-xs">
        bucket
      </label>
      <div className="border-border focus-within:border-foreground relative flex items-center gap-2 border-b">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: selected?.color }}
        />
        <select
          id="item-bucket"
          value={choice.value}
          onChange={(e) => choice.onChange(Number(e.target.value))}
          disabled={disabled}
          // 16px on phones: iOS zooms the page into any smaller control
          className="min-w-0 flex-1 appearance-none truncate bg-transparent py-1.5 pr-6 font-mono text-base outline-none disabled:opacity-50 sm:text-sm"
        >
          {choice.options.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute right-0"
        />
      </div>
    </div>
  );
}
