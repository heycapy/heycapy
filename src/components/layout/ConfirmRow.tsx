import { BracketButton } from "@/components/ui/BracketButton";

type ConfirmRowProps = {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
};

export function ConfirmRow({ text, onConfirm, onCancel, disabled }: ConfirmRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
