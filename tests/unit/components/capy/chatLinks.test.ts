import { expect, it } from "vitest";
import { appHref } from "@/components/capy/chatLinks";

const PAGE = "http://localhost:3000";
const APP_URL = "https://app.heycapy.test";

it.each([
  ["http://localhost:3000/?bucket=3#item-7", "/?bucket=3#item-7"],
  ["https://app.heycapy.test/?bucket=3#item-7", "/?bucket=3#item-7"],
  ["/?bucket=3#item-7", "/?bucket=3#item-7"],
])("keeps the app's own link %s clickable, on the address it's open at", (href, path) => {
  expect(appHref(href, PAGE, APP_URL)).toBe(path);
});

it.each([
  "https://evil.test/?bucket=3#item-7",
  "https://app.heycapy.test.evil.test/",
  "http://app.heycapy.test/",
  "//evil.test/login",
  "javascript:alert(1)",
  "mailto:a@evil.test",
  undefined,
])("shows %s as plain text", (href) => {
  expect(appHref(href, PAGE, APP_URL)).toBeNull();
});

it("trusts only the page's address without an APP_URL", () => {
  expect(appHref("https://app.heycapy.test/?bucket=3", PAGE, null)).toBeNull();
  expect(appHref("http://localhost:3000/?bucket=3", PAGE, null)).toBe("/?bucket=3");
});
