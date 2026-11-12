import { describe, it, expect } from "vitest";
import { submitKeys } from "@/lib/keybinds/submit";

describe("submitKeys", () => {
  it("is plain Enter in the add box and Ctrl or Cmd with Enter in the form", () => {
    expect(submitKeys(false, false)).toBe("Enter");
    expect(submitKeys(true, false)).toBe("Enter");
    expect(submitKeys(false, true)).toBe("Ctrl+Enter");
    expect(submitKeys(true, true)).toBe("Cmd+Enter");
  });
});
