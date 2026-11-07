import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tooltip } from "@/components/ui/Tooltip";

afterEach(cleanup);

it("shows its text while the target is hovered or focused, and hides after", () => {
  render(
    <Tooltip text="pick a date first">
      <button type="button">repeat</button>
    </Tooltip>
  );
  const target = screen.getByRole("button", { name: "repeat" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.mouseEnter(target.parentElement as HTMLElement);
  expect(screen.getByRole("tooltip").textContent).toBe("pick a date first");
  fireEvent.mouseLeave(target.parentElement as HTMLElement);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focus(target);
  expect(screen.getByRole("tooltip")).toBeTruthy();
});

it("leaves its child alone when there's nothing to say", () => {
  const { container } = render(
    <Tooltip>
      <button type="button">repeat</button>
    </Tooltip>
  );
  expect(container.firstElementChild?.tagName).toBe("BUTTON");
});
