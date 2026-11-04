import { describe, expect, it } from "vitest";
import { checkFields, fieldKey } from "@/lib/buckets/field-schema";

describe("fieldKey", () => {
  it("turns a label into the key its values are stored under", () => {
    expect(fieldKey("Monthly cost")).toBe("monthly_cost");
    expect(fieldKey("Price ($)")).toBe("price_");
  });
});

describe("checkFields", () => {
  it("accepts fields the editor makes, and template keys like autoRenew", () => {
    const result = checkFields([
      { key: "monthly_cost", label: "Monthly cost", type: "currency", currency: "₹" },
      { key: "autoRenew", label: "Auto-renew", type: "boolean" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("refuses two fields with the same key", () => {
    expect(
      checkFields([
        { key: "price", label: "Price", type: "number" },
        { key: "price", label: "price", type: "currency" },
      ])
    ).toEqual({ ok: false, error: 'Two fields share the key "price"' });
  });

  it("refuses a choice field without options", () => {
    expect(checkFields([{ key: "plan", label: "Plan", type: "select" }])).toEqual({
      ok: false,
      error: '"Plan" is a choice field and needs options',
    });
  });

  it("refuses an unknown type or a field without a label", () => {
    expect(checkFields([{ key: "x", label: "X", type: "colour" }]).ok).toBe(false);
    expect(checkFields([{ key: "x", label: "", type: "text" }]).ok).toBe(false);
  });
});
