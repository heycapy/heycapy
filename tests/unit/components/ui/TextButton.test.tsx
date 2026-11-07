import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TextButton, TextLink } from "@/components/ui/TextButton";
import { LookProvider } from "@/components/looks/LookProvider";

afterEach(cleanup);

it("brackets its label outside any look", () => {
  render(
    <>
      <TextButton>add</TextButton>
      <TextLink href="/x">all changes</TextLink>
    </>
  );
  expect(screen.getByRole("button").textContent).toBe("[add]");
  expect(screen.getByRole("link").textContent).toBe("[all changes]");
});

it("shows the bare label in a plain look", () => {
  render(
    <LookProvider look="modern">
      <TextButton>add</TextButton>
      <TextLink href="/x">all changes</TextLink>
    </LookProvider>
  );
  expect(screen.getByRole("button").textContent).toBe("add");
  expect(screen.getByRole("link").textContent).toBe("all changes");
});
