import { expect, it } from "vitest";
import { cn } from "@/lib/utils";

it("keeps a frame width next to a border colour", () => {
  expect(cn("border-t-frame", "border-border")).toBe("border-t-frame border-border");
  expect(cn("border-frame", "border-primary")).toBe("border-frame border-primary");
  expect(cn("border-x-frame", "border-(--accent)")).toBe("border-x-frame border-(--accent)");
});

it("lets a later width, rounding or shadow replace a token", () => {
  expect(cn("border-frame", "border-0")).toBe("border-0");
  expect(cn("rounded-panel", "rounded-none")).toBe("rounded-none");
  expect(cn("rounded-control", "rounded-full")).toBe("rounded-full");
  expect(cn("shadow-raised-sm", "shadow-none")).toBe("shadow-none");
});

it("treats the named text sizes and fonts as sizes and fonts, not colours", () => {
  expect(cn("text-muted-foreground", "text-2xs")).toBe("text-muted-foreground text-2xs");
  expect(cn("text-3xs", "text-foreground")).toBe("text-3xs text-foreground");
  expect(cn("font-display", "font-ui")).toBe("font-ui");
});

it("keeps a look's line style next to a line colour", () => {
  expect(cn("divide-border/50", "divide-divider")).toBe("divide-border/50 divide-divider");
  expect(cn("divide-border", "divide-rule")).toBe("divide-border divide-rule");
  expect(cn("border-border", "border-rule")).toBe("border-border border-rule");
  expect(cn("border-rule", "border-solid")).toBe("border-solid");
});
