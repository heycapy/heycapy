import type { Locator, Page } from "@playwright/test";

export async function centerOf(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("nothing to touch");
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

// A finger sliding sideways, driven through Chrome DevTools (the context needs hasTouch)
export async function touchSwipe(page: Page, target: Locator, dx: number) {
  const { x, y } = await centerOf(target);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) {
    const point = { x: Math.round(x + (dx * step) / 10), y };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
