import { describe, expect, it } from "vitest";
import { newItemId, parseItemId } from "@/lib/items/item-id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newItemId", () => {
  it("makes UUIDv7 ids", () => {
    expect(newItemId()).toMatch(UUID_V7);
  });

  it("makes ids that are unique and sort in the order they were made", () => {
    const ids = Array.from({ length: 2000 }, () => newItemId());
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("parseItemId", () => {
  it("accepts an id the app made, and one the migration made", () => {
    const made = newItemId();
    expect(parseItemId(made)).toBe(made);
    expect(parseItemId("0193f5a0-0000-7000-8000-000000000007")).toBe(
      "0193f5a0-0000-7000-8000-000000000007"
    );
  });

  it.each([7, "7", "", "not-an-id", null, undefined, {}, "0193f5a0-0000-7000-8000-00000000000g"])(
    "refuses %j",
    (value) => {
      expect(parseItemId(value)).toBeNull();
    }
  );
});
