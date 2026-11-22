import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-4 px-4 py-12 sm:px-8">
      <h1 className="text-display font-bold text-balance">No encontramos esta página</h1>
      <p className="text-body text-muted-foreground">
        La dirección no existe o cambió. Volvé al inicio para seguir.
      </p>
      <Button asChild size="lg">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
