import { memberName } from "@/lib/buckets/member-name";
import type { BucketMember } from "@/lib/buckets/members";
import type { ItemAssignee } from "./ItemRow";

export function itemAssignee(person: {
  userId: number;
  username: string | null;
  avatar: string | null;
  isYou: boolean;
}): ItemAssignee {
  return {
    userId: person.userId,
    name: person.isYou ? "you" : memberName(person),
    avatar: person.avatar,
    isYou: person.isYou,
  };
}

// A new item's draft says nothing about who it's for until someone picks, which means everyone
export function resolveAssignees(members: BucketMember[], ids: number[] | null): number[] {
  return ids ?? members.map((m) => m.userId);
}

export function toggleAssignee(members: BucketMember[], selected: number[], userId: number) {
  const next = new Set(selected);
  if (!next.delete(userId)) next.add(userId);
  return members.filter((m) => next.has(m.userId)).map((m) => m.userId);
}

// Naming someone narrows "everyone" to them and adds to a list that's already narrowed, "@everyone"
// goes back to all of them
export function mentionAssignees(
  members: BucketMember[],
  ids: number[] | null,
  userId: number | null
) {
  if (userId === null) return members.map((m) => m.userId);
  return ids === null ? [userId] : [...new Set([...ids, userId])];
}

export function assigneeLabel(members: BucketMember[], ids: number[] | null): string {
  const selected = resolveAssignees(members, ids);
  if (selected.length === members.length) return "everyone";
  if (selected.length === 0) return "no one";
  const [first] = members.filter((m) => selected.includes(m.userId));
  if (selected.length > 1) return `${selected.length} people`;
  return `${memberName(first)}${first.isYou ? " (you)" : ""}`;
}
