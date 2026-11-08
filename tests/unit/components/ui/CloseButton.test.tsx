import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CloseButton } from "@/components/ui/CloseButton";
import { LookProvider } from "@/components/looks/LookProvider";

afterEach(cleanup);

it("is a bracketed x outside any look", () => {
  render(<CloseButton />);
  expect(screen.getByRole("button").textContent).toBe("[x]");
});

it("is an icon named close in a plain look, unless given a name", () => {
  render(
    <LookProvider look="modern">
      <CloseButton />
      <CloseButton aria-label="close menu" />
    </LookProvider>
  );
  expect(screen.getByRole("button", { name: "close" }).querySelector("svg")).not.toBeNull();
  expect(screen.getByRole("button", { name: "close menu" })).toBeTruthy();
});
