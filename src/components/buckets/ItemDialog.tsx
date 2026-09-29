import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BracketButton } from "@/components/ui/BracketButton";
import { TimeField, type Ampm, type TimeValue } from "@/components/ui/TimeField";
import { RecurringPicker } from "./RecurringPicker";
import { ItemFieldsForm } from "./ItemFieldsForm";
import { ItemStatusField } from "./ItemStatusField";
import { ItemDialogFrame } from "./ItemDialogFrame";
import { ItemDrawerFrame } from "./ItemDrawerFrame";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { buildDeadline, deadlineDate } from "@/lib/time";
import { ITEM_TITLE_MAX_LENGTH, MOBILE_MEDIA_QUERY } from "@/constants";

const LABEL = "text-muted-foreground font-mono text-xs";

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

type ItemDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  title: string;
  deadline: string;
  status: string;
  statuses: StatusDef[];
  fields?: FieldDef[];
  properties?: Record<string, unknown>;
  recurring?: RecurringConfig | null;
  error?: string;
  pending?: boolean;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onPropertiesChange?: (v: Record<string, unknown>) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSkip?: () => void;
};

export function ItemDialog({
  open,
  mode,
  title,
  deadline,
  status,
  statuses,
  fields,
  properties,
  recurring,
  error,
  pending,
  onTitleChange,
  onDeadlineChange,
  onStatusChange,
  onPropertiesChange,
  onRecurringChange,
  onConfirm,
  onCancel,
  onDelete,
  onSkip,
}: ItemDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);
  useScrollLock(open);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [timeHour, setTimeHour] = useState("9");
  const [timeMin, setTimeMin] = useState("00");
  const [timeAmpm, setTimeAmpm] = useState<Ampm>("am");
  const wasOpenRef = useRef(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const hasFields = !!(fields && fields.length > 0);

  const datePart = deadlineDate(deadline);
  const hasDate = datePart.length > 0;

  const hasEmptyRequired = !!fields?.some(
    (f) => f.validation?.required && isEmpty(properties?.[f.key])
  );

  useEffect(() => {
    const didJustOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!didJustOpen) return;
    // Deferred: the drawer's portal renders the textarea one render after opening
    const id = setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        // On a phone the keyboard would cover the drawer; only a new item needs typing right away
        if (!isMobile || mode === "add") el.focus();
      }
      setValidationAttempted(false);
      if (deadline.includes("T")) {
        const d = new Date(deadline);
        const h24 = d.getHours();
        setTimeHour(String(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24));
        setTimeMin(String(d.getMinutes()).padStart(2, "0"));
        setTimeAmpm(h24 >= 12 ? "pm" : "am");
      } else {
        setTimeHour("9");
        setTimeMin("00");
        setTimeAmpm("am");
      }
    }, 0);
    return () => clearTimeout(id);
  }, [open, deadline, isMobile, mode]);

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onTitleChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  function handleDateChange(newDate: string) {
    onDeadlineChange(buildDeadline(newDate, timeHour, timeMin, timeAmpm));
    if (!newDate) onRecurringChange?.(null);
  }

  function handleTimeChange({ hour, min, ampm }: TimeValue) {
    setTimeHour(hour);
    setTimeMin(min);
    setTimeAmpm(ampm);
    if (datePart) onDeadlineChange(buildDeadline(datePart, hour, min, ampm));
  }

  function handleConfirmClick() {
    setValidationAttempted(true);
    if (!title.trim()) {
      scrollToFirst("[data-title-section]");
      return;
    }
    if (hasEmptyRequired) {
      const firstEmpty = fields?.find(
        (f) => f.validation?.required && isEmpty(properties?.[f.key])
      );
      if (firstEmpty) scrollToFirst(`[data-field-key="${firstEmpty.key}"]`);
      return;
    }
    onConfirm();
  }

  const titleHasError = validationAttempted && !title.trim();

  const whenAndStatus = (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>when</label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <DatePicker value={datePart} onChange={handleDateChange} disabled={pending} />
          </div>
          {hasDate && (
            <TimeField
              value={{ hour: timeHour, min: timeMin, ampm: timeAmpm }}
              onChange={handleTimeChange}
              disabled={pending}
            />
          )}
          {hasDate && !pending && (
            <button
              type="button"
              onClick={() => handleDateChange("")}
              aria-label="remove date"
              className="text-muted-foreground hover:text-destructive -mr-1 shrink-0 p-1 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {hasDate && onRecurringChange && (
        <RecurringPicker
          recurring={recurring}
          deadlineDay={Number(datePart.slice(8, 10))}
          initialShowEndDate={!!recurring?.endDate}
          disabled={pending}
          onChange={onRecurringChange}
        />
      )}

      <ItemStatusField
        status={status}
        statuses={statuses}
        onChange={onStatusChange}
        disabled={pending}
      />
    </>
  );

  const Frame = isMobile ? ItemDrawerFrame : ItemDialogFrame;

  return (
    <Frame
      open={open}
      heading={mode === "add" ? "new item" : "edit item"}
      wide={hasFields}
      scrollBodyRef={scrollBodyRef}
      onCancel={onCancel}
      footer={
        <>
          {onDelete ? (
            <button
              onClick={onDelete}
              disabled={pending}
              aria-label="delete item"
              className="text-foreground/60 hover:text-destructive transition-colors disabled:opacity-25"
            >
              <Trash2 size={12} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {onSkip && (
              <BracketButton onClick={onSkip} disabled={pending}>
                skip
              </BracketButton>
            )}
            <BracketButton onClick={handleConfirmClick} disabled={pending}>
              {mode === "add" ? "add" : "update"}
            </BracketButton>
          </div>
        </>
      }
    >
      <div data-title-section className="flex flex-col gap-1.5 pb-5">
        <label className={cn(LABEL, titleHasError && "text-destructive")}>title</label>
        <textarea
          ref={textareaRef}
          value={title}
          onChange={handleTitleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && title.trim()) {
              e.preventDefault();
              handleConfirmClick();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder={error || "what needs doing?"}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          disabled={pending}
          rows={1}
          className={cn(
            "focus:border-foreground w-full resize-none overflow-hidden border-b bg-transparent py-1.5 text-sm outline-none disabled:opacity-50",
            error || titleHasError
              ? "border-destructive placeholder:text-destructive"
              : "border-border placeholder:text-muted-foreground"
          )}
        />
        {titleHasError && (
          <p className="text-destructive font-mono text-[11px]">title is required</p>
        )}
      </div>

      {hasFields ? (
        <div className="flex flex-col gap-5">
          {onPropertiesChange && fields && (
            <div className="border-border border">
              <ItemFieldsForm
                fields={fields}
                values={properties ?? {}}
                disabled={pending}
                showErrors={validationAttempted}
                onChange={onPropertiesChange}
              />
            </div>
          )}
          {whenAndStatus}
        </div>
      ) : (
        <div className="flex flex-col gap-5">{whenAndStatus}</div>
      )}
    </Frame>
  );
}
