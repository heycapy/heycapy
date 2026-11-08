import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toggle } from "@/components/ui/Toggle";
import { LookProvider } from "@/components/looks/LookProvider";

afterEach(cleanup);

it("is a named pair of on / off buttons outside any look", () => {
  const onChange = vi.fn();
  render(<Toggle label="use emoji" value={false} onChange={onChange} />);
  const group = screen.getByRole("group", { name: "use emoji" });
  fireEvent.click(screen.getByRole("button", { name: "on" }));
  expect(onChange).toHaveBeenCalledWith(true);
  expect(group.contains(screen.getByRole("button", { name: "off" }))).toBe(true);
});

it("is a named switch in a look that uses switches", () => {
  const onChange = vi.fn();
  render(
    <LookProvider look="modern">
      <Toggle label="use emoji" value onChange={onChange} />
    </LookProvider>
  );
  const toggle = screen.getByRole("switch", { name: "use emoji" });
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(toggle);
  expect(onChange).toHaveBeenCalledWith(false);
});
