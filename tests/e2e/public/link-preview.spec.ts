import { test, expect } from "@playwright/test";

test("shared links get a preview card with an image anyone can load", async ({ page, request }) => {
  await page.goto("/home");
  const meta = (property: string) => page.locator(`meta[property="${property}"]`);
  await expect(meta("og:title")).toHaveAttribute("content", "heycapy");
  await expect(meta("og:description")).toHaveAttribute(
    "content",
    "a capy to help you with your day."
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image"
  );

  const imageUrl = await meta("og:image").getAttribute("content");
  expect(imageUrl).toMatch(/^http:\/\/localhost:3100\/opengraph-image/);
  const image = await request.get(imageUrl ?? "", { maxRedirects: 0 });
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("the preview image points at whichever domain the link was shared from", async ({
  request,
}) => {
  const res = await request.get("/login", {
    headers: { host: "heycapy.example", "x-forwarded-proto": "https" },
  });
  expect(await res.text()).toMatch(
    /<meta property="og:image" content="https:\/\/heycapy\.example\/opengraph-image/
  );
});
