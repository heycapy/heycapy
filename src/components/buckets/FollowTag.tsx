type FollowTagProps = {
  following: boolean;
  onUseTweaks: () => void;
  disabled?: boolean;
};

export function FollowTag({ following, onUseTweaks, disabled }: FollowTagProps) {
  if (following) {
    return <span className="text-muted-foreground font-ui text-2xs">from tweaks</span>;
  }
  return (
    <button
      type="button"
      onClick={onUseTweaks}
      disabled={disabled}
      className="text-primary hover:text-foreground font-ui text-2xs underline disabled:opacity-50"
    >
      use tweaks
    </button>
  );
}
