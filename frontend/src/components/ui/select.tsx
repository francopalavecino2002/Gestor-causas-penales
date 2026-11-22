import * as React from "react";
import { ChevronDown } from "lucide-react";

import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Native <select>: the phone's own picker is the most usable one for a lawyer in a hallway, and
 * it is accessible and keyboard-friendly for free. Pass <option> children as usual.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="select-wrapper" className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          fieldClasses,
          "min-h-11 cursor-pointer appearance-none py-2 pr-11",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
