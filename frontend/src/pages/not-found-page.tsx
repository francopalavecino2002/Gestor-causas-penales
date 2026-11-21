import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-4 px-4 py-12 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        No encontramos esta página
      </h1>
      <p className="text-muted-foreground">
        La dirección no existe o cambió. Volvé al inicio para seguir.
      </p>
      <Button asChild size="lg" className="min-h-11">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
