import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";

/** A section that exists in the navigation but whose screen comes in a later task. */
export function PlaceholderPage({
  title,
  subtitle,
  icon: Icon,
  description,
}: {
  title: string;
  subtitle?: ReactNode;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <>
      <PageHeader title={title}>{subtitle}</PageHeader>
      <section
        aria-labelledby="placeholder-title"
        className="grid max-w-2xl justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6"
      >
        <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <h2 id="placeholder-title" className="text-title font-bold">
          Próximamente
        </h2>
        <p className="max-w-prose text-body text-muted-foreground">{description}</p>
      </section>
    </>
  );
}
