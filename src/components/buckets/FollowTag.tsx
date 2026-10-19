type FollowTagProps = {
  following: boolean;
  onUseTweaks: () => void;
  disabled?: boolean;
};

export function FollowTag({ following, onUseTweaks, disabled }: FollowTagProps) {
  if (following) {
    return <span className="text-muted-foreground font-mono text-[11px]">from tweaks</span>;
  }
  return (
    <button
      type="button"
      onClick={onUseTweaks}
      disabled={disabled}
      className="text-primary hover:text-foreground font-mono text-[11px] underline disabled:opacity-50"
    >
      use tweaks
    </button>
  );
}
