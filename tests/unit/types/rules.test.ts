import { expect, it } from "vitest";
import { RecurringConfig, buildPropertyValidator, type FieldDef } from "@/types/rules";

it("keeps zod's own error messages, which webhook callers and capy read", () => {
  const repeat = RecurringConfig.safeParse({ frequency: "weekly", interval: 0 });
  expect(repeat.error?.issues[0].message).toBe("Too small: expected number to be >0");

  const field: FieldDef = {
    key: "cost",
    label: "Cost",
    type: "number",
    validation: { min: 5 },
  };
  const property = buildPropertyValidator([field]).safeParse({ cost: 1 });
  expect(property.error?.issues[0].message).toBe("Too small: expected number to be >=5");
});
