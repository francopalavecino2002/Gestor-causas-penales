import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One chapter of the style guide: an h2, a short intro and its specimens. */
export function GuideSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-6 gap-4">
      <div className="grid gap-1">
        <h2 id={headingId} className="text-title font-bold">
          {title}
        </h2>
        <p className="max-w-prose text-meta text-muted-foreground">{intro}</p>
      </div>
      {children}
    </section>
  );
}

/** A labeled board where components are shown on the card surface. */
export function Specimen({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:p-6">
      {title ? <h3 className="text-meta font-bold text-muted-foreground">{title}</h3> : null}
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}
