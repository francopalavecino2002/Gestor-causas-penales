import type { ReactNode } from "react";

/** Screen title (the page's only h1) with an optional line under it. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="grid gap-1.5">
      <h1 className="text-display font-bold text-balance">{title}</h1>
      {children && <div className="text-body text-muted-foreground">{children}</div>}
    </header>
  );
}
