import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The shape of a few person rows while the list loads. */
export function PersonListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando las personas" className="grid gap-3">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** The person's header and first sections while the detail loads. */
export function PersonDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando la persona" className="grid gap-7">
      <div className="grid gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-3/5 max-w-lg" />
        <Skeleton className="h-5 w-2/5 max-w-sm" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** A person id that does not exist in this firm (or is not even an id). */
export function PersonNotFound() {
  return (
    <section className="grid max-w-2xl justify-items-start gap-4">
      <h1 className="text-display font-bold text-balance">No encontramos a esta persona</h1>
      <p className="text-body text-muted-foreground">
        Puede que la dirección esté mal o que la hayan cargado en otro estudio. Buscala por nombre o
        documento en la lista.
      </p>
      <Button asChild size="lg">
        <Link to="/personas">Volvé a las personas</Link>
      </Button>
    </section>
  );
}
