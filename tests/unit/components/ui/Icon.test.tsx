import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Icon } from "@/components/ui/Icon";
import { ICON_SETS } from "@/components/ui/icon-sets";
import { ICON_NAMES } from "@/components/ui/constants";
import { LookProvider } from "@/components/looks/LookProvider";

afterEach(cleanup);

it("every icon set draws every icon name", () => {
  for (const set of Object.values(ICON_SETS)) {
    for (const name of ICON_NAMES) {
      const Svg = set.icons[name];
      const { container, unmount } = render(<Svg />);
      expect(container.querySelector("svg"), name).not.toBeNull();
      unmount();
    }
  }
});

it("draws the pixel set outside any look", () => {
  const svg = render(<Icon name="search" />).container.querySelector("svg");
  expect(svg?.getAttribute("width")).toBe(String(ICON_SETS.pixel.size));
  expect(svg?.getAttribute("shape-rendering")).toBe("crispEdges");
  expect(svg?.getAttribute("aria-hidden")).toBe("true");
});

it("draws the look's icon set", () => {
  const svg = render(
    <LookProvider look="modern">
      <Icon name="search" />
    </LookProvider>
  ).container.querySelector("svg");
  expect(svg?.getAttribute("width")).toBe(String(ICON_SETS.line.size));
  expect(svg?.getAttribute("shape-rendering")).toBeNull();
  expect(svg?.getAttribute("aria-hidden")).toBe("true");
});
