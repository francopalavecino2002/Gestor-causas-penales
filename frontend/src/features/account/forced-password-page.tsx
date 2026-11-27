import { CircleAlert, LogOut } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordChangeForm } from "@/features/account/password-change-form";
import type { Me } from "@/features/auth/auth-api";
import { LoginPanel } from "@/features/auth/login-panel";
import { useLogout } from "@/features/auth/use-logout";

/**
 * Shown instead of the app while the user still has the temporary password the owner gave them
 * (ADR-0044). Same frame as the login, because for the user it is the last step of signing in:
 * the server refuses everything else until they choose their own password.
 */
export function ForcedPasswordPage({ me }: { me: Me }) {
  const logout = useLogout();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <LoginPanel />
      <main
        id="contenido"
        className="flex min-h-dvh flex-col px-4 pt-6 pb-10 sm:px-8 lg:justify-center lg:px-10"
      >
        <div className="mx-auto grid w-full max-w-md gap-8">
          <BrandMark className="lg:hidden" />
          <header className="grid gap-2">
            <h1 className="text-display font-bold text-balance">Elegí tu contraseña</h1>
            <p className="text-body text-muted-foreground">
              Entraste con la contraseña temporal que te dio la persona titular del estudio. Para
              usar el sistema, elegí una propia: solo vos la vas a saber.
            </p>
          </header>

          <dl className="grid gap-0.5 rounded-lg border bg-card px-4 py-3 text-meta">
            <dt className="sr-only">Cuenta</dt>
            <dd className="font-bold">{me.displayName}</dd>
            <dd className="break-all text-muted-foreground">{me.email}</dd>
            <dt className="sr-only">Estudio</dt>
            <dd className="text-muted-foreground">{me.tenant.name}</dd>
          </dl>

          <PasswordChangeForm current="temporal" submitLabel="Guardá tu contraseña" stretch />

          <div className="grid gap-3 border-t pt-6">
            {logout.isError && (
              <Alert variant="error" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>No pudimos cerrar la sesión</AlertTitle>
                <AlertDescription>Revisá tu conexión a internet y probá de nuevo.</AlertDescription>
              </Alert>
            )}
            <p className="text-meta text-muted-foreground">
              ¿No es tu cuenta o preferís hacerlo después? Cerrá la sesión: la próxima vez que
              ingreses te la vamos a pedir de nuevo.
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              disabled={logout.isPending}
              onClick={() => logout.mutate({ estudio: me.tenant.slug })}
            >
              <LogOut aria-hidden="true" />
              Cerrá la sesión
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
