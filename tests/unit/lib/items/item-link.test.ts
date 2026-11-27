import { expect, it } from "vitest";
import { itemLink } from "@/lib/items/item-link";

const ITEM = "0193f5a0-0000-7000-8000-000000000007";

it.each([
  [`/?bucket=3#item-${ITEM}`, { bucketId: 3, itemId: ITEM }],
  [`/#item-${ITEM}`, { bucketId: null, itemId: ITEM }],
  [`/?bucket=x#item-${ITEM}`, { bucketId: null, itemId: ITEM }],
])("reads %s as an item to open", (path, link) => {
  expect(itemLink(path)).toEqual(link);
});

it.each([
  "/?bucket=3",
  "/?bucket=3#item-",
  `/settings#item-${ITEM}`,
  `/?bucket=3#items-${ITEM}`,
  "/?bucket=3#item-7",
  "/?bucket=3#item-not-an-id",
])("%s isn't a link to an item", (path) => {
  expect(itemLink(path)).toBeNull();
});
