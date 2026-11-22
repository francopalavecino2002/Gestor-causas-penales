import { useRouter } from "@tanstack/react-router";
import { CircleAlert, RotateCw } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { NETWORK_ERROR, isApiError } from "@/lib/api";

/** The app could not tell who is signed in (server down, offline). Says so and offers a retry. */
export function SessionErrorPage({ error }: { error: unknown }) {
  const router = useRouter();
  const offline = isApiError(error) && error.type === NETWORK_ERROR;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-12 sm:px-8">
      <BrandMark />
      <div className="grid gap-3">
        <h1 className="flex items-start gap-3 text-display font-bold text-balance">
          <CircleAlert aria-hidden="true" className="mt-1.5 size-7 shrink-0 text-destructive" />
          No pudimos abrir tu sesión
        </h1>
        <p className="text-body text-muted-foreground">
          {offline
            ? "No hay conexión con el servidor. Revisá tu conexión a internet y probá de nuevo."
            : "El servidor no respondió como esperábamos. Probá de nuevo en unos minutos."}
        </p>
      </div>
      <Button size="lg" className="w-fit" onClick={() => void router.invalidate()}>
        <RotateCw aria-hidden="true" />
        Probá de nuevo
      </Button>
    </main>
  );
}
