import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WhatsNewDialog } from "@/components/layout/WhatsNewDialog";

// Real releases change every version, so the button is checked against made-up ones
vi.mock("@/lib/whats-new/constants", () => ({
  CHANGELOG_URL: "https://example.com/changelog",
  RELEASES_SHOWN: 3,
  RELEASES: [
    { version: "9.1.0", notes: [{ title: "plain note", text: "nothing to open." }] },
    {
      version: "9.0.0",
      notes: [{ title: "guide note", text: "try the guide.", showGuide: true }],
    },
  ],
}));

afterEach(cleanup);

it("show me on a guide note opens the guide", async () => {
  const onShowGuide = vi.fn();
  render(<WhatsNewDialog open onClose={vi.fn()} onShowGuide={onShowGuide} />);

  const buttons = screen.getAllByRole("button", { name: /show me/ });
  expect(buttons).toHaveLength(1);
  expect(screen.getByRole("region", { name: "9.0.0" }).contains(buttons[0] ?? null)).toBe(true);

  await userEvent.click(buttons[0] ?? document.body);
  expect(onShowGuide).toHaveBeenCalledOnce();
});
