import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Status tones carry an 8 px dot in the text color; the word is always there (color is never the
// only signal). Use <HearingStatusBadge> for hearing statuses instead of picking a tone by hand.
const dot =
  "before:size-2 before:shrink-0 before:rounded-full before:bg-current before:content-['']";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-0.5 text-small font-bold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-secondary text-secondary-foreground",
        outline: "border-border-strong text-foreground",
        programada: cn(dot, "bg-status-programada-soft text-status-programada"),
        reprogramada: cn(dot, "bg-status-reprogramada-soft text-status-reprogramada"),
        efectiva: cn(dot, "bg-status-efectiva-soft text-status-efectiva"),
        suspendida: cn(dot, "bg-status-suspendida-soft text-status-suspendida"),
        // Red means one thing only: a client deprived of liberty.
        detained: "border-detained-edge bg-detained-soft text-detained",
        deadline: "bg-deadline-soft text-deadline",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "neutral"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeVariant };
