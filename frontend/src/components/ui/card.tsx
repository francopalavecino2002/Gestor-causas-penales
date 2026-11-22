import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Flat: a 1 px border and no shadow. The edge variants add the 6 px left edge from DESIGN.md.
const cardVariants = cva(
  "grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4 text-card-foreground",
  {
    variants: {
      edge: {
        none: "",
        detained: "border-l-6 border-l-detained-edge",
        deadline: "border-l-6 border-l-deadline-edge",
      },
    },
    defaultVariants: { edge: "none" },
  },
);

/** Pass `asChild` to render a semantic element, e.g. <article> for a hearing. */
function Card({
  className,
  edge,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="card" className={cn(cardVariants({ edge }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5", className)}
      {...props}
    />
  );
}

/** An <h3> by default; pass `as` to fit the heading outline of the page. */
function CardTitle({
  className,
  as: Heading = "h3",
  ...props
}: React.ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Heading
      data-slot="card-title"
      className={cn("text-card-title font-bold text-balance", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-small font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Metadata rows, 4 px apart. Pass `asChild` to render a <dl>. */
function CardContent({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="card-content" className={cn("grid gap-1", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center gap-2 pt-1", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
