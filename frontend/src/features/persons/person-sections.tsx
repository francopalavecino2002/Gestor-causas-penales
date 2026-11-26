import { useId, type ReactNode } from "react";

/** A titled block of the detail; `h2` so the outline reads Persona > Causas > Cliente... */
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  /** A button next to the title, e.g. "Agregá un contacto". */
  action?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-title font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface Term {
  term: string;
  value: ReactNode;
}

export function TermList({ terms, className }: { terms: Term[]; className?: string }) {
  return (
    <dl className={className ?? "grid gap-x-6 gap-y-3 text-meta"}>
      {terms.map(({ term, value }) => (
        <div key={term} className="grid min-w-0 content-start">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Missing() {
  return <span className="text-muted-foreground">Sin cargar</span>;
}
