import { describe, expect, it } from "vitest";
import {
  findMention,
  mentionOptions,
  removeMention,
  type MentionMember,
} from "@/lib/items/mention";

const members: MentionMember[] = [
  { userId: 1, username: "dapper_squid_traveling", displayName: null, isYou: true },
  { userId: 2, username: "wobbly_falcon_reading", displayName: "Sam", isYou: false },
  { userId: 3, username: "sleepy_otter_juggling", displayName: "Sara", isYou: false },
];

describe("findMention", () => {
  it("finds an @ at the end of the words typed so far", () => {
    expect(findMention("buy milk @sa", 12)).toEqual({ start: 9, end: 12, query: "sa" });
    expect(findMention("@", 1)).toEqual({ start: 0, end: 1, query: "" });
    expect(findMention("@sam buy milk", 4)).toEqual({ start: 0, end: 4, query: "sam" });
  });

  it("only looks at the text before the cursor", () => {
    expect(findMention("buy @sa milk", 7)).toEqual({ start: 4, end: 7, query: "sa" });
    expect(findMention("buy @sa milk", 12)).toBeNull();
  });

  it("ignores an @ inside a word, like an email address", () => {
    expect(findMention("mail bob@example.com", 20)).toBeNull();
    expect(findMention("a@b", 3)).toBeNull();
  });

  it("is over once a space follows the name", () => {
    expect(findMention("buy milk @sam ", 14)).toBeNull();
  });
});

describe("mentionOptions", () => {
  it("lists everyone and anyone for a bare @", () => {
    expect(mentionOptions(members, "").map((o) => o.userId)).toEqual([1, 2, 3, null]);
  });

  it("narrows by the start of the name or of the username, ignoring case", () => {
    expect(mentionOptions(members, "SA").map((o) => o.label)).toEqual(["Sam", "Sara"]);
    expect(mentionOptions(members, "wob").map((o) => o.label)).toEqual(["Sam"]);
    expect(mentionOptions(members, "dap").map((o) => o.label)).toEqual([
      "dapper_squid_traveling (you)",
    ]);
  });

  it("shows the username next to a name, and anyone only while it can still match", () => {
    expect(mentionOptions(members, "sam")).toEqual([
      { userId: 2, label: "Sam", username: "wobbly_falcon_reading" },
    ]);
    expect(mentionOptions(members, "any")).toEqual([
      { userId: null, label: "anyone", username: null },
    ]);
  });

  it("is empty when nobody matches", () => {
    expect(mentionOptions(members, "zzz")).toEqual([]);
  });
});

describe("removeMention", () => {
  it("takes the @ and what follows it out of the end of the title", () => {
    const mention = { start: 9, end: 12, query: "sa" };
    expect(removeMention("buy milk @sa", mention)).toEqual({ text: "buy milk", caret: 8 });
  });

  it("takes it out of the start or the middle without leaving extra spaces", () => {
    expect(removeMention("@sa buy milk", { start: 0, end: 3, query: "sa" })).toEqual({
      text: "buy milk",
      caret: 0,
    });
    expect(removeMention("buy @sa milk", { start: 4, end: 7, query: "sa" })).toEqual({
      text: "buy milk",
      caret: 3,
    });
  });

  it("leaves the rest of the title as it was", () => {
    expect(removeMention("call @ at 5", { start: 5, end: 6, query: "" })).toEqual({
      text: "call at 5",
      caret: 4,
    });
  });
});
