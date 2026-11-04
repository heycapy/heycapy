import { dueLabel, type DueTone } from "@/lib/items/due-label";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<DueTone, string> = {
  late: "bg-destructive/15 text-destructive -ml-1 px-1",
  today: "font-medium text-(--status-on-hold)",
  near: "text-foreground",
  later: "text-muted-foreground",
  closed: "text-muted-foreground",
};

type ItemDueProps = {
  due: { at: Date; allDay: boolean } | null;
  status: string;
};

export function ItemDue({ due, status }: ItemDueProps) {
  const label = due && dueLabel(due, status);
  // Shown first but read after the title, so a screen reader starts with what the item is
  return (
    <span className="order-first flex w-16 shrink-0 flex-col items-start font-mono text-xs whitespace-nowrap @3xl:w-32">
      {label ? (
        <>
          <span className={TONE_CLASS[label.tone]}>{label.state}</span>
          <span
            className={cn(
              "text-muted-foreground mt-0.5",
              label.short !== label.full && "@3xl:hidden"
            )}
          >
            {label.short}
          </span>
          {label.short !== label.full && (
            <span className="text-muted-foreground mt-0.5 hidden @3xl:inline">{label.full}</span>
          )}
        </>
      ) : (
        <>
          <span aria-hidden className="text-muted-foreground/50">
            —
          </span>
          <span className="sr-only">no date</span>
        </>
      )}
    </span>
  );
}
