import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("grid gap-4", className)} {...props} />;
}

/** Segmented track, as in the agenda's "Día / Semana" switch. Scrolls sideways if it overflows. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex w-fit max-w-full overflow-x-auto rounded-lg border bg-secondary p-0.75",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-meta font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-segment [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn(className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
