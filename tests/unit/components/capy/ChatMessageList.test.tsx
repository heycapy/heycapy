import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChatMessageList } from "@/components/capy/ChatMessageList";

const APP_URL = "https://app.heycapy.test";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}));

beforeAll(() => {
  Element.prototype.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  onOpenItem.mockClear();
});

const onOpenItem = vi.fn();

function reply(content: string) {
  render(
    <ChatMessageList
      messages={[{ id: "1", role: "assistant", content }]}
      streaming={false}
      appUrl={APP_URL}
      onOpenItem={onOpenItem}
    />
  );
}

it("makes a link to an item clickable, on the address the app is open at", async () => {
  reply(`here it is: [netflix](${APP_URL}/?bucket=3#item-7)`);
  expect((await screen.findByRole("link", { name: "netflix" })).getAttribute("href")).toBe(
    "/?bucket=3#item-7"
  );
});

it("shows a link to another site as text with its address, not clickable", async () => {
  reply("log in again: [your account](https://evil.test/login)");
  const shown = await screen.findByText(/your account \(https:\/\/evil\.test\/login\)/);
  expect(screen.queryByRole("link")).toBeNull();
  expect(shown.textContent).toContain("your account (https://evil.test/login)");
});

it("opens an item it links to in place, without leaving the page", async () => {
  reply(`here it is: [netflix](${APP_URL}/?bucket=3#item-7)`);
  const opened = fireEvent.click(await screen.findByRole("link", { name: "netflix" }));
  expect(opened).toBe(false);
  expect(onOpenItem).toHaveBeenCalledWith(3, 7);
});

it("leaves a ctrl / cmd click to the browser, for a new tab", async () => {
  reply(`here it is: [netflix](${APP_URL}/?bucket=3#item-7)`);
  fireEvent.click(await screen.findByRole("link", { name: "netflix" }), { ctrlKey: true });
  expect(onOpenItem).not.toHaveBeenCalled();
});
