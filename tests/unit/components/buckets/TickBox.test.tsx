import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TickBox } from "@/components/buckets/TickBox";
import { LookProvider } from "@/components/looks/LookProvider";

afterEach(cleanup);

it("draws a pixel box with a dot when done, outside any look", () => {
  render(<TickBox title="bread" checked color="red" onToggle={() => {}} />);
  const tick = screen.getByRole("checkbox", { name: "bread" });
  expect(tick.getAttribute("aria-checked")).toBe("true");
  expect(tick.querySelector("svg")?.getAttribute("shape-rendering")).toBe("crispEdges");
  expect(tick.querySelectorAll("path")).toHaveLength(2);
});

it("draws a circle with a check when done in the round look", async () => {
  const { rerender } = render(
    <LookProvider look="modern">
      <TickBox title="bread" checked={false} color="red" onToggle={() => {}} />
    </LookProvider>
  );
  const tick = screen.getByRole("checkbox", { name: "bread" });
  expect(tick.querySelector(".rounded-full")).not.toBeNull();
  expect(tick.querySelector<SVGPathElement>(".rounded-full svg path")?.style.opacity).toBe("0");

  rerender(
    <LookProvider look="modern">
      <TickBox title="bread" checked color="red" onToggle={() => {}} />
    </LookProvider>
  );
  const check = tick.querySelector<SVGPathElement>(".rounded-full svg path");
  expect(check?.getAttribute("d")).toBe("M20 6 9 17l-5-5");
  await expect.poll(() => check?.style.opacity).toBe("1");
});
