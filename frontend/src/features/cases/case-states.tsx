import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlert, FolderSearch, type LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError, NETWORK_ERROR } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The shape of a few case rows while the list loads. */
export function CaseListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando las causas" className="grid gap-3">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-5 w-2/5" />
          <div className="flex gap-3">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The shape of the case header and its first sections while the detail loads. */
export function CaseDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando la causa" className="grid gap-7">
      <div className="grid gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-4/5 max-w-xl" />
        <Skeleton className="h-5 w-3/5 max-w-md" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Nothing to show: say it plainly and offer the next useful step. */
export function CasesEmpty({
  title,
  description,
  icon: Icon = FolderSearch,
  children,
  className,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
  /** E.g. `max-w-none` to line up with a toolbar above it. */
  className?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "grid max-w-2xl justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-6 text-primary" />
      <h2 id={titleId} className="text-title font-bold">
        {title}
      </h2>
      <p className="max-w-prose text-body text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap gap-3 pt-1">{children}</div>}
    </section>
  );
}

/** What happened and what to do, with a retry. Not red: red is for liberty only. */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const offline = isApiError(error) && error.type === NETWORK_ERROR;
  return (
    <Alert variant="error" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          {offline
            ? "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a intentar."
            : "El servidor no respondió como esperábamos. Volvé a intentar en unos minutos."}
        </p>
        <Button variant="outline" className="mt-2 justify-self-start" onClick={onRetry}>
          Volvé a intentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * A case that does not exist, or a reserved one the user is not on the team of: the backend
 * answers 404 to both on purpose, so the screen does not tell them apart either.
 */
export function CaseNotFound() {
  return (
    <section className="grid max-w-2xl justify-items-start gap-4">
      <h1 className="text-display font-bold text-balance">No encontramos esta causa</h1>
      <p className="text-body text-muted-foreground">
        Puede que la dirección esté mal, o que sea una causa reservada y no estés en su equipo. Si
        tenés que verla, pedile al responsable de la causa que te sume.
      </p>
      <Button asChild size="lg">
        <Link to="/causas">Volvé a las causas</Link>
      </Button>
    </section>
  );
}
