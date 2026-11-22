import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Vertical stack of label, control, help text and error. */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field" className={cn("grid gap-1.5", className)} {...props} />;
}

/** Help text under a control. Link it with aria-describedby. */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("max-w-prose text-small text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Validation message: destructive text with an icon and a sentence that says how to fix it.
 * Never a red page or a red background (red is reserved for detained clients).
 */
function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p
      data-slot="field-error"
      className={cn(
        "flex max-w-prose gap-1.5 text-small font-semibold text-destructive",
        className,
      )}
      {...props}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export { Field, FieldDescription, FieldError };
