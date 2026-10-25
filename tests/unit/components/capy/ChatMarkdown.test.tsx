import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatMarkdown } from "@/components/capy/ChatMarkdown";

afterEach(() => cleanup());

function reply(content: string) {
  return render(<ChatMarkdown content={content} appUrl={null} />).container;
}

it("shows a table the user asked for as a table", () => {
  reply(
    [
      "| item | price | renews |",
      "| --- | ---: | --- |",
      "| Netflix | ₹499 | Fri 2026-10-30 |",
      "| Spotify | ₹119 | Mon 2026-11-02 |",
    ].join("\n")
  );
  expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
    "item",
    "price",
    "renews",
  ]);
  expect(screen.getAllByRole("cell").map((c) => c.textContent)).toEqual([
    "Netflix",
    "₹499",
    "Fri 2026-10-30",
    "Spotify",
    "₹119",
    "Mon 2026-11-02",
  ]);
});

it("keeps a wide table scrolling inside the bubble", () => {
  reply("| a | b |\n| - | - |\n| 1 | 2 |");
  expect(screen.getByRole("table").parentElement?.className).toContain("overflow-x-auto");
});

it("shows strikethrough and task lists", () => {
  const container = reply("~~cancelled~~\n\n- [x] paid rent\n- [ ] call bank");
  expect(container.querySelector("del")?.textContent).toBe("cancelled");
  const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
  expect(boxes.map((b) => b.checked)).toEqual([true, false]);
  expect(boxes.every((b) => b.disabled)).toBe(true);
});

it("never loads an image, it shows its alt text", () => {
  const container = reply("![tracking pixel](https://evil.test/p.png)");
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("tracking pixel");
});

it("shows a bare address once and doesn't make an outside one clickable", () => {
  const container = reply("see https://evil.test/login or mail a@evil.test");
  expect(screen.queryByRole("link")).toBeNull();
  expect(container.textContent).toBe("see https://evil.test/login or mail a@evil.test");
});

it("keeps one background on a code block", () => {
  const container = reply("```\nnpm i\n```");
  expect(container.querySelector("pre")?.className).toContain("[&>code]:bg-transparent");
});
