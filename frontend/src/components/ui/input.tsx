import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared look of text fields: 44 px high, 3:1 border, invalid state from aria-invalid. */
export const fieldClasses =
  "w-full min-w-0 rounded-lg border border-border-strong bg-card px-3.5 text-body text-foreground transition-colors duration-fast ease-out placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive aria-invalid:border-2";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClasses,
        "min-h-11 py-2 file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
