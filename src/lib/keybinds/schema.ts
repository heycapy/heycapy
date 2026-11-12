import { z } from "zod";
import { KEYBIND_ACTIONS } from "./constants";
import { mergeBindings } from "./match";

const rebindableIds = KEYBIND_ACTIONS.filter((a) => a.rebindable).map((a) => a.id);

const prefixSchema = z
  .object({
    key: z.string().length(1),
    ctrl: z.boolean(),
    meta: z.boolean(),
    alt: z.boolean(),
    shift: z.boolean(),
  })
  .refine((p) => p.ctrl || p.meta || p.alt, "The prefix needs Ctrl, Cmd or Alt");

export const storedKeybindsSchema = z
  .object({
    prefix: prefixSchema.nullable().optional(),
    bindings: z.partialRecord(z.enum(rebindableIds), z.string().length(1)).optional(),
    hints: z.boolean().optional(),
  })
  .refine((stored) => {
    const keys = Object.values(mergeBindings(stored.bindings ?? {}));
    return new Set(keys).size === keys.length;
  }, "Two actions share a key");

export type StoredKeybinds = z.infer<typeof storedKeybindsSchema>;

export function parseStoredKeybinds(raw: unknown): StoredKeybinds {
  const parsed = storedKeybindsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
