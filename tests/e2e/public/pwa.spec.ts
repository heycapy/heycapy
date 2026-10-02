import { test, expect } from "@playwright/test";

test("the app manifest and icons load without logging in", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(manifest.status()).toBe(200);
  const body = (await manifest.json()) as { display: string; icons: { src: string }[] };
  expect(body).toMatchObject({ name: "HeyCapy", start_url: "/", display: "standalone" });

  for (const icon of body.icons) {
    const res = await request.get(icon.src, { maxRedirects: 0 });
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
});

test("the service worker loads without logging in", async ({ request }) => {
  const sw = await request.get("/sw.js", { maxRedirects: 0 });
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(await sw.text()).toContain("showNotification");
});

test("pages link the manifest so browsers offer to install", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );
});
