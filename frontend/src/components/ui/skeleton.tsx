import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder block while data loads. Decorative: wrap a group of skeletons in an element with
 * aria-busy="true" and a visually hidden "Cargando…" so screen readers get one message.
 * The pulse stops under prefers-reduced-motion (index.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
