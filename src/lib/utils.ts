import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Without these, tailwind-merge reads border-t-frame as a border colour and drops it next to border-border
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["panel", "control"],
      shadow: ["raised-sm", "raised", "raised-md", "raised-lg", "edge"],
    },
    classGroups: {
      "border-w": [{ border: ["frame"] }],
      "border-w-x": [{ "border-x": ["frame"] }],
      "border-w-t": [{ "border-t": ["frame"] }],
      "border-w-b": [{ "border-b": ["frame"] }],
      "border-w-l": [{ "border-l": ["frame"] }],
      "border-w-r": [{ "border-r": ["frame"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
