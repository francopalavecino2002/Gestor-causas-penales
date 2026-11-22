import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The product type scale (index.css) replaces Tailwind's. tailwind-merge must know these names
 * are font sizes; otherwise it reads `text-meta` as a color and drops it next to `text-primary`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["small", "meta", "body", "card-title", "time", "title", "display"],
    },
  },
});

/** Merges conditional class names and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
