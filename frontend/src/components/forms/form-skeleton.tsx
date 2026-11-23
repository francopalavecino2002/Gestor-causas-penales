import { Skeleton } from "@/components/ui/skeleton";

/** What a form shows while the lists it offers (catalogs, the case) load. */
export function FormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando el formulario" className="grid gap-5">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
