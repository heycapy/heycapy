export function ViewOnlyNotice({ tab }: { tab: "items" | "notifications" }) {
  return (
    <div
      role="note"
      className="border-foreground bg-muted/40 flex flex-col gap-1 border border-dashed px-3 py-2.5"
    >
      <p className="text-foreground font-mono text-sm font-semibold">view only</p>
      <p className="text-foreground/80 font-mono text-xs leading-snug">
        the owner sets these for everyone in this bucket.{" "}
        {tab === "notifications"
          ? "you can still pick your own channels below."
          : "you can pick where your own reminders go under notifications."}
      </p>
    </div>
  );
}
