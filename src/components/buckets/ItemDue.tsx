import { ITEM_STATUS } from "@/constants";
import { dueLabel, type DueTone } from "@/lib/items/due-label";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<DueTone, string> = {
  late: "text-destructive",
  today: "font-medium text-(--status-on-hold)",
  near: "text-primary",
  later: "text-muted-foreground",
  closed: "text-muted-foreground",
};

type ItemDueProps = {
  due: { at: Date; allDay: boolean } | null;
  status: string;
  timeOnly?: boolean;
};

export function ItemDue({ due, status, timeOnly = false }: ItemDueProps) {
  if (!due || status === ITEM_STATUS.completed) return null;
  const label = dueLabel(due, status);
  const split = label.short !== label.full;
  return (
    <span className={cn("font-ui whitespace-nowrap", TONE_CLASS[label.tone])}>
      {label.tone === "today" ? (
        <>
          {!timeOnly && `${label.state}, `}
          {label.full}
        </>
      ) : (
        <>
          {label.state} · <span className={cn(split && "@2xl:hidden")}>{label.short}</span>
          {split && <span className="hidden @2xl:inline">{label.full}</span>}
        </>
      )}
    </span>
  );
}
