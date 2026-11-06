import { expect, it } from "vitest";
import { itemLink } from "@/lib/items/item-link";

it.each([
  ["/?bucket=3#item-7", { bucketId: 3, itemId: 7 }],
  ["/#item-7", { bucketId: null, itemId: 7 }],
  ["/?bucket=x#item-7", { bucketId: null, itemId: 7 }],
])("reads %s as an item to open", (path, link) => {
  expect(itemLink(path)).toEqual(link);
});

it.each(["/?bucket=3", "/?bucket=3#item-", "/settings#item-7", "/?bucket=3#items-7"])(
  "%s isn't a link to an item",
  (path) => {
    expect(itemLink(path)).toBeNull();
  }
);
