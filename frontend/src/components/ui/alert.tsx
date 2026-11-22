import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Put a lucide icon as the first child: it takes the variant's icon color and the grid aligns the
// text next to it. No role by default: add role="alert" only for messages that appear after an
// action and must be announced (errors), not for content that is there on load.
const alertVariants = cva(
  "grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-lg border px-4 py-3.5 text-body text-foreground has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        info: "bg-card [&>svg]:text-primary",
        // A client deprived of liberty: the only red surface in the product.
        detained:
          "border-l-6 border-detained-edge bg-detained-soft [&_[data-slot=alert-title]]:text-detained [&>svg]:text-detained",
        deadline:
          "border-l-6 border-deadline-edge bg-deadline-soft [&_[data-slot=alert-title]]:text-deadline [&>svg]:text-deadline",
        // Something failed: what happened and what to do, on a normal surface.
        error:
          "border-destructive bg-card [&_[data-slot=alert-title]]:text-destructive [&>svg]:text-destructive",
        // Quiet inline note, e.g. the assisted-calculation disclaimer under a deadline.
        disclaimer:
          "border-transparent bg-transparent px-0 py-0 text-small text-muted-foreground has-[>svg]:grid-cols-[1.125rem_1fr] has-[>svg]:gap-x-2 [&>svg]:size-4.5",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "info"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-title"
      className={cn("col-start-2 font-bold text-pretty", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid max-w-prose gap-1 text-pretty", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
