import { ITEM_STATUS } from "@/constants";
import { OptionButton } from "@/components/ui/OptionButton";
import type { StatusDef } from "@/types/rules";

type ItemStatusFieldProps = {
  status: string;
  statuses: StatusDef[];
  onChange: (status: string) => void;
  disabled?: boolean;
};

export function ItemStatusField({ status, statuses, onChange, disabled }: ItemStatusFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted-foreground font-mono text-xs">status</label>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <OptionButton
            key={s.name}
            active={status === s.name}
            onClick={() => onChange(s.name)}
            disabled={disabled}
            className="flex items-center gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </OptionButton>
        ))}
      </div>
      {status === ITEM_STATUS.missed && (
        <p className="text-warning font-mono text-xs">
          ⏭ this occurrence was missed — pick a status to reopen it
        </p>
      )}
      {status && status !== ITEM_STATUS.missed && !statuses.find((s) => s.name === status) && (
        <p className="text-destructive font-mono text-xs">
          &quot;{status}&quot; is not a valid status — pick one above to fix it
        </p>
      )}
    </div>
  );
}
