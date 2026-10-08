import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { BuyCredits } from "@/components/layout/BuyCredits";
import { PurchaseReturn } from "@/components/layout/PurchaseReturn";
import { CHECKOUT_BALANCE_RECHECK_SECONDS } from "@/constants";
import { useUIStore } from "@/store/ui";

const actions = vi.hoisted(() => ({
  getCreditPacksAction: vi.fn(),
  startCheckoutAction: vi.fn(),
}));
vi.mock("@/app/(app)/billing-actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PACKS = [
  { id: "pack_5", usd: 5, credits: 600 },
  { id: "pack_10", usd: 10, credits: 1400 },
];

beforeEach(() => {
  actions.getCreditPacksAction.mockResolvedValue({ ok: true, packs: PACKS });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

it("offers each pack with what a message costs", async () => {
  render(<BuyCredits />);
  expect(await screen.findByRole("button", { name: /buy for \$5/ })).toBeTruthy();
  expect(screen.getByText(/600 messages to capy · 0\.83¢ per message/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /buy for \$10/ })).toBeTruthy();
  expect(screen.getByText(/1,400 messages to capy · 0\.71¢ per message/)).toBeTruthy();
  expect(screen.getByText(/taxes included, credits never expire/)).toBeTruthy();
});

it("says buying isn't open when there is nothing to buy", async () => {
  actions.getCreditPacksAction.mockResolvedValue({ ok: true, packs: [] });
  render(<BuyCredits />);
  expect(await screen.findByText("buying credits isn't open yet.")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("opens the checkout for the pack that was picked", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  actions.startCheckoutAction.mockResolvedValue({
    ok: true,
    url: "https://test.checkout.example/pay",
  });
  render(<BuyCredits />);
  await userEvent.click(await screen.findByRole("button", { name: /buy for \$10/ }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("https://test.checkout.example/pay"));
  expect(actions.startCheckoutAction).toHaveBeenCalledWith("pack_10");
  vi.unstubAllGlobals();
});

it("shows why the checkout didn't start", async () => {
  actions.startCheckoutAction.mockResolvedValue({
    ok: false,
    error: "Couldn't start the checkout. Try again in a bit.",
  });
  render(<BuyCredits />);
  await userEvent.click(await screen.findByRole("button", { name: /buy for \$5/ }));
  expect(await screen.findByText("Couldn't start the checkout. Try again in a bit.")).toBeTruthy();
});

it("on the way back from a payment it says so, opens tweaks and looks at the balance again", () => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/?payment_id=pay_1&status=success&email=a%40b.c");
  const onPaid = vi.fn();
  const before = useUIStore.getState().aiRefreshTick;
  render(<PurchaseReturn onPaid={onPaid} />);

  expect(toast.success).toHaveBeenCalledWith("payment received. your credits arrive in a moment.");
  expect(onPaid).toHaveBeenCalledOnce();
  expect(window.location.search).toBe("");
  vi.advanceTimersByTime(Math.max(...CHECKOUT_BALANCE_RECHECK_SECONDS) * 1000);
  expect(useUIStore.getState().aiRefreshTick).toBe(
    before + CHECKOUT_BALANCE_RECHECK_SECONDS.length
  );
});

it("on the way back from a failed payment it says nothing was charged", () => {
  window.history.replaceState(null, "", "/?payment_id=pay_1&status=failed&email=a%40b.c");
  const onPaid = vi.fn();
  render(<PurchaseReturn onPaid={onPaid} />);
  expect(toast.error).toHaveBeenCalledWith("the payment didn't go through. you weren't charged.");
  expect(onPaid).not.toHaveBeenCalled();
});

it("does nothing on a normal visit", () => {
  render(<PurchaseReturn onPaid={vi.fn()} />);
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
