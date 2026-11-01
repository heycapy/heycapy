import { describe, expect, it } from "vitest";
import { toolLogLine, withToolLog } from "@/lib/ai/toolLog";

const call = (name: string, args: Record<string, unknown> = {}) => ({
  id: "c",
  name,
  arguments: args,
});

describe("toolLogLine", () => {
  it.each(["list_buckets", "list_items", "search_items", "get_bucket_settings"])(
    "leaves out %s, which changes nothing",
    (name) => {
      expect(toolLogLine(call(name), '{"ok":true}')).toBeNull();
    }
  );

  it.each([
    ['{"ok":true,"itemId":54}', "done, new item 54"],
    ['{"ok":true,"bucketId":3}', "done, new bucket 3"],
    ['{"ok":true,"newStatus":"completed"}', "done, now completed"],
    ['{"ok":true}', "done"],
    [
      '{"ok":false,"needsConfirmation":true,"error":"Ask"}',
      "nothing done yet, asked the user to confirm",
    ],
    ['{"ok":false,"error":"Item not found"}', "failed: Item not found"],
    ["not json", "failed"],
  ])("says what %s means", (result, outcome) => {
    expect(toolLogLine(call("update_item", { item_id: 7 }), result)).toBe(
      `- update_item {"item_id":7} → ${outcome}`
    );
  });

  it("keeps a long error short", () => {
    const line = toolLogLine(
      call("add_item"),
      JSON.stringify({ ok: false, error: "x".repeat(500) })
    );
    expect(line).toBe(`- add_item {} → failed: ${"x".repeat(200)}`);
  });
});

describe("withToolLog", () => {
  it("puts the log before the reply", () => {
    expect(withToolLog("Added it", "- a\n- b")).toBe(
      "<tools_used>\n- a\n- b\n</tools_used>\nAdded it"
    );
  });

  it("leaves a reply without tools alone", () => {
    expect(withToolLog("hi", null)).toBe("hi");
  });
});
