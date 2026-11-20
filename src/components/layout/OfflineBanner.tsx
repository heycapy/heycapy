export function OfflineBanner() {
  return (
    <div className="px-4 pt-3">
      <div
        role="status"
        className="rounded-control border-border text-muted-foreground font-ui border-rule border px-3 py-2 text-xs"
      >
        can&apos;t reach heycapy. what&apos;s on screen may be out of date, and changes can&apos;t
        be saved.
      </div>
    </div>
  );
}
