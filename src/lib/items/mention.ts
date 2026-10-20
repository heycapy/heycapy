import { memberName } from "@/lib/buckets/member-name";

export type Mention = { start: number; end: number; query: string };

export type MentionMember = {
  userId: number;
  username: string | null;
  avatar: string | null;
  isYou: boolean;
};

export type MentionOption = {
  userId: number | null;
  avatar: string | null;
  label: string;
};

// An @ that starts a word, up to the cursor, an @ inside a word is an address, not a mention
export function findMention(text: string, caret: number): Mention | null {
  const match = /(?:^|\s)@(\S*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  const end = caret;
  const start = end - match[1].length - 1;
  return { start, end, query: match[1] };
}

const ANYONE = "anyone";

export function mentionOptions(members: MentionMember[], query: string): MentionOption[] {
  const q = query.toLowerCase();
  const people = members
    .filter((member) => (member.username ?? "").toLowerCase().startsWith(q))
    .map((member) => ({
      userId: member.userId,
      avatar: member.avatar,
      label: `${memberName(member)}${member.isYou ? " (you)" : ""}`,
    }));
  const anyone = ANYONE.startsWith(q) ? [{ userId: null, avatar: null, label: ANYONE }] : [];
  return [...people, ...anyone];
}

// The title keeps its words and loses only the @ and what was typed after it
export function removeMention(text: string, mention: Mention): { text: string; caret: number } {
  let before = text.slice(0, mention.start);
  const after = text.slice(mention.end);
  if (before.endsWith(" ") && (after === "" || after.startsWith(" "))) before = before.slice(0, -1);
  if (before === "") return { text: after.trimStart(), caret: 0 };
  return { text: before + after, caret: before.length };
}
