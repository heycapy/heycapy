import type { ToolCall } from "./types";

const TITLE_MAX = 40;

function quoted(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  return `"${text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text}"`;
}

// What capy is doing, in the words the chat shows while it works
export function toolStatus(call: ToolCall, bucketName: (id: unknown) => string | null): string {
  const args = call.arguments ?? {};
  const bucket = bucketName(args.bucket_id);
  const bucketOr = (fallback: string) => bucket ?? fallback;

  switch (call.name) {
    case "list_buckets":
      return "looking at your buckets";
    case "create_bucket":
      return `creating ${quoted(args.name) ?? "a bucket"}`;
    case "update_bucket":
      return `updating ${bucketOr("the bucket")}`;
    case "delete_bucket":
      return `moving ${bucketOr("the bucket")} to the trash`;
    case "add_item":
      return `adding ${quoted(args.title) ?? "an item"}${bucket ? ` to ${bucket}` : ""}`;
    case "update_item":
      return "updating the item";
    case "complete_item":
      return "checking off the item";
    case "delete_item":
      return "moving the item to the trash";
    case "move_item":
      return `moving the item to ${bucketOr("another bucket")}`;
    case "list_items":
      return `looking through ${bucketOr("the bucket")}`;
    case "search_items": {
      const keyword = quoted(args.keyword);
      return keyword ? `searching for ${keyword}` : "searching your items";
    }
    case "get_bucket_settings":
      return `checking ${bucket ? `${bucket}'s` : "the bucket's"} settings`;
    case "update_bucket_settings":
      return `changing ${bucket ? `${bucket}'s` : "the bucket's"} settings`;
    default:
      return "working on it";
  }
}
