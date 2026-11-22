import { Scale } from "lucide-react";

import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "Gestor de causas penales";

/** The scale on a primary tile, with or without the product name next to it. */
export function BrandMark({
  className,
  withName = true,
  inverted = false,
}: {
  className?: string;
  withName?: boolean;
  /** For use on a primary surface: the tile turns light and the name takes the surface color. */
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
          inverted
            ? "bg-primary-foreground text-primary dark:bg-primary dark:text-primary-foreground"
            : "bg-sidebar-primary text-sidebar-primary-foreground",
        )}
      >
        <Scale className="size-5" />
      </span>
      {withName && <span className="text-meta leading-tight font-bold">{PRODUCT_NAME}</span>}
    </span>
  );
}
