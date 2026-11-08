import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";

describe("built-in templates", () => {
  it("keep done items in the list, so ticking never makes an item vanish", async () => {
    await seed(0);
    const builtIns = await db
      .select()
      .from(templates)
      .where(and(eq(templates.isBuiltin, true), isNull(templates.userId)));

    expect(builtIns.length).toBeGreaterThan(0);
    for (const template of builtIns) {
      const rules = JSON.parse(template.rulesJson) as { items?: { showCompleted?: boolean } };
      expect(rules.items?.showCompleted, template.name).toBe(true);
    }
  });
});
