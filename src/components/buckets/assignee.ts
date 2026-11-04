import { memberName } from "@/lib/buckets/member-name";
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
