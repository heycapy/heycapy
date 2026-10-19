import type { BucketMember } from "@/lib/buckets/members";
import { placesOf } from "@/lib/timezones/gap";

export function TimezonesNotice({ members }: { members: BucketMember[] }) {
  const { places } = placesOf(members);
  if (places.length < 2) return null;
  return (
    <p className="text-muted-foreground mx-4 mb-3 font-mono text-xs">
      people here are in {places.length} timezones · {places.join(", ")}
    </p>
  );
}
