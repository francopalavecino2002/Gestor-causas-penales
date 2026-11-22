import type { ReactNode } from "react";
import { CalendarCheck, CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** The shape of three hearings while the agenda loads. */
export function AgendaSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando la agenda" className="grid gap-3.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="grid grid-cols-[3.25rem_1fr] gap-x-7 md:grid-cols-[3.75rem_1fr]"
        >
          <Skeleton className="mt-3.5 h-6 w-full" />
          <div className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Nothing scheduled: say it plainly and offer the next useful place to look. */
export function AgendaEmpty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="agenda-empty-title"
      className="grid max-w-2xl justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card px-5 py-6"
    >
      <CalendarCheck aria-hidden="true" className="size-6 text-primary" />
      <h2 id="agenda-empty-title" className="text-title font-bold">
        {title}
      </h2>
      <p className="max-w-prose text-body text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap gap-3 pt-1">{children}</div>}
    </section>
  );
}

/** What happened and what to do, with a retry. Not red: red is for liberty only. */
export function AgendaError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = isApiError(error) && error.type === NETWORK_ERROR;
  return (
    <Alert variant="error" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>No pudimos cargar la agenda</AlertTitle>
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
