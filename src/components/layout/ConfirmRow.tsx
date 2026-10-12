import { BracketButton } from "@/components/ui/BracketButton";
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
      <span className="text-destructive font-mono text-xs">{text}</span>
      <BracketButton type="button" variant="destructive" onClick={onConfirm} disabled={disabled}>
        confirm
      </BracketButton>
      <BracketButton type="button" onClick={onCancel} disabled={disabled}>
        cancel
      </BracketButton>
    </div>
  );
}
