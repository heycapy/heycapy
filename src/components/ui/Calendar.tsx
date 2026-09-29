import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function parseDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3) return null;
  return { year: parts[0] ?? 0, month: (parts[1] ?? 1) - 1, day: parts[2] ?? 1 };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type CalendarProps = {
  value: string;
  onSelect: (date: string) => void;
};

export function Calendar({ value, onSelect }: CalendarProps) {
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const parsed = parseDate(value);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  function shiftMonth(by: 1 | -1) {
    const index = viewYear * 12 + viewMonth + by;
    setViewYear(Math.floor(index / 12));
    setViewMonth(((index % 12) + 12) % 12);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="previous month"
          className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-pixel text-xs">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="next month"
          className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {DAYS_SHORT.map((d) => (
          <span key={d} className="text-muted-foreground py-1 text-center font-mono text-[11px]">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDay }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayStr = toDateStr(viewYear, viewMonth, day);
          const isSelected = dayStr === value;
          const isToday = dayStr === todayStr;
          return (
            <button
              type="button"
              key={day}
              onClick={() => onSelect(toDateStr(viewYear, viewMonth, day))}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center font-mono text-xs transition-colors",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "border-border text-foreground border font-bold",
                !isSelected && !isToday && "text-foreground hover:bg-muted"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
