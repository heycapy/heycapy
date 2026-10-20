import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, users, userSettings } from "@/lib/db/schema";
import { memberName } from "@/lib/buckets/member-name";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";
import { CAPY_ASSIGNEE } from "@/constants";

type Person = {
  bucketId: number;
  userId: number;
  name: string;
  username: string | null;
  timezone: string;
};

export type AssigneeChange =
  { kind: "none" } | { kind: "set"; assigneeId: number | null } | { kind: "error"; error: string };

async function peopleIn(bucketIds: number[]): Promise<Person[]> {
  if (bucketIds.length === 0) return [];
  const rows = await db
    .select({
      bucketId: bucketMembers.bucketId,
      userId: users.id,
      username: users.username,
      timezone: userSettings.timezone,
    })
    .from(bucketMembers)
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(inArray(bucketMembers.bucketId, bucketIds))
    .orderBy(asc(bucketMembers.createdAt), asc(bucketMembers.id));
  return rows.map((row) => ({
    bucketId: row.bucketId,
    userId: row.userId,
    name: memberName(row),
    username: row.username,
    timezone: row.timezone ?? UNSET_TIMEZONE,
  }));
}

function findPeople(people: Person[], viewerId: number, name: string): Person[] {
  const wanted = name.trim().toLowerCase();
  if (wanted === CAPY_ASSIGNEE.me) return people.filter((p) => p.userId === viewerId);
  return people.filter((p) => p.username?.toLowerCase() === wanted);
}

// The deadline is read on the clock of whoever it's assigned to, like the app's item form
export async function assigneeFromArgs(
  args: Record<string, unknown>,
  viewerId: number,
  viewerTimezone: string,
  bucket: { id: number; name: string },
  savedAssigneeId: number | null
): Promise<{ change: AssigneeChange; clock: string }> {
  const people = await peopleIn([bucket.id]);
  const clockFor = (assigneeId: number | null) => {
    const assignee = people.find((p) => p.userId === assigneeId);
    const theirs =
      args.deadline_on_my_clock !== true &&
      assignee &&
      assignee.userId !== viewerId &&
      assignee.timezone !== UNSET_TIMEZONE;
    return theirs ? assignee.timezone : viewerTimezone;
  };
  const savedClock = clockFor(savedAssigneeId);

  if (args.assignee === undefined) return { change: { kind: "none" }, clock: savedClock };
  const wanted = args.assignee === null ? CAPY_ASSIGNEE.anyone : String(args.assignee);
  if (wanted.trim().toLowerCase() === CAPY_ASSIGNEE.anyone) {
    return { change: { kind: "set", assigneeId: null }, clock: clockFor(null) };
  }

  const error = (text: string) => ({
    change: { kind: "error" as const, error: text },
    clock: savedClock,
  });
  if (people.length < 2) {
    return error(`"${bucket.name}" isn't shared with anyone, so its items can't be assigned.`);
  }
  const found = findPeople(people, viewerId, wanted);
  const [person] = found;
  if (!person || found.length > 1) {
    const names = people.map((p) => (p.userId === viewerId ? "the user" : p.name));
    return error(
      `${person ? "More than one person" : "No one"} called "${wanted}" in "${bucket.name}". ` +
        `Its members: ${names.join(", ")}. Ask the user who they mean.`
    );
  }
  return { change: { kind: "set", assigneeId: person.userId }, clock: clockFor(person.userId) };
}

// For the prompt: the names to assign by, only on buckets shared with someone
export async function withMemberNames<T extends { id: number }>(
  viewerId: number,
  buckets: T[]
): Promise<(T & { members?: string[] })[]> {
  const people = await peopleIn(buckets.map((b) => b.id));
  return buckets.map((bucket) => {
    const inBucket = people.filter((p) => p.bucketId === bucket.id);
    if (inBucket.length < 2) return bucket;
    return {
      ...bucket,
      members: inBucket.map((p) =>
        p.userId === viewerId ? `${CAPY_ASSIGNEE.me} (the user)` : p.name
      ),
    };
  });
}
