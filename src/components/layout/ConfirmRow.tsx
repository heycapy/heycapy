import { TextButton } from "@/components/ui/TextButton";
import { cn } from "@/lib/utils";

type ConfirmRowProps = {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
  className?: string;
};

export function ConfirmRow({ text, onConfirm, onCancel, disabled, className }: ConfirmRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-destructive font-ui text-xs">{text}</span>
      <TextButton type="button" variant="destructive" onClick={onConfirm} disabled={disabled}>
        confirm
      </TextButton>
      <TextButton type="button" onClick={onCancel} disabled={disabled}>
        cancel
      </TextButton>
    </div>
  );
}
