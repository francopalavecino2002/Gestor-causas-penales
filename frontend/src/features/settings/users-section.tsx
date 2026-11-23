import { useId } from "react";
import { Info, ShieldCheck, ShieldOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/components/shell/user-initials";
import { useMe } from "@/features/auth/me-query";
import { ROLE_LABELS } from "@/features/auth/roles";
import { ROLE_DESCRIPTIONS, ROLE_ORDER } from "@/features/settings/settings-copy";
import { SettingsPage } from "@/features/settings/settings-layout";

/** Who is signed in, with which role, and whether the second step is on. */
function AccountCard() {
  const titleId = useId();
  const { data: me } = useMe();
  // The route guard guarantees a user.
  if (!me) return null;
  return (
    <section aria-labelledby={titleId} className="grid gap-3">
      <h2 id={titleId} className="text-title font-bold">
        Tu cuenta
      </h2>
      <div className="grid gap-4 rounded-xl border bg-card px-4 py-4 sm:flex sm:items-start">
        <span
          aria-hidden="true"
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-title font-bold text-accent-foreground"
        >
          {initialsOf(me.displayName, me.email)}
        </span>
        <dl className="grid min-w-0 flex-1 gap-3 text-body sm:grid-cols-2">
          <div className="grid gap-0.5">
            <dt className="text-meta text-muted-foreground">Nombre</dt>
            <dd className="font-bold">{me.displayName}</dd>
          </div>
          <div className="grid min-w-0 gap-0.5">
            <dt className="text-meta text-muted-foreground">Email</dt>
            <dd className="break-all">{me.email}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-meta text-muted-foreground">Rol</dt>
            <dd className="font-semibold">{ROLE_LABELS[me.role]}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-meta text-muted-foreground">Verificación en dos pasos</dt>
            <dd className="grid gap-1">
              {me.twoFactorEnabled ? (
                <Badge variant="efectiva">Activada</Badge>
              ) : (
                <Badge variant="deadline">
                  <ShieldOff aria-hidden="true" />
                  Desactivada
                </Badge>
              )}
            </dd>
          </div>
        </dl>
      </div>
      <p className="flex max-w-prose items-start gap-2 text-meta text-muted-foreground">
        {me.twoFactorEnabled ? (
          <>
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-status-efectiva"
            />
            <span>
              Al ingresar te pedimos el código de tu app de autenticación. Si perdés el teléfono,
              usá uno de tus códigos de recuperación.
            </span>
          </>
        ) : (
          <>
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              Te recomendamos activarla: protege datos de causas penales aunque alguien conozca tu
              contraseña. Activarla desde esta pantalla llega con una próxima versión; mientras
              tanto, pedíselo a quien administra el sistema.
            </span>
          </>
        )}
      </p>
    </section>
  );
}

function RolesGuide() {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-3">
      <div className="grid gap-1">
        <h2 id={titleId} className="text-title font-bold">
          Qué puede hacer cada rol
        </h2>
        <p className="max-w-prose text-meta text-muted-foreground">
          Cada persona del estudio tiene un rol. El sistema controla estos permisos en cada acción.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ROLE_ORDER.map((role) => (
          <li
            key={role}
            className="grid content-start gap-2 rounded-xl border bg-card px-4 pt-3.5 pb-4"
          >
            <h3 className="text-card-title font-bold">{ROLE_LABELS[role]}</h3>
            <ul className="grid list-disc gap-1 pl-5 text-meta marker:text-muted-foreground">
              {ROLE_DESCRIPTIONS[role].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * `/ajustes/usuarios`: read only. The API has no endpoint to list, invite or change users yet
 * (ADR-0026), so the screen shows the account and the roles and says so plainly.
 */
export function UsersSection() {
  return (
    <SettingsPage
      section="/ajustes/usuarios"
      intro="Tu cuenta en este estudio y los permisos de cada rol."
    >
      <div className="grid max-w-3xl gap-7">
        <AccountCard />
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            Invitar personas, cambiar roles y desactivar cuentas llega con una próxima versión. Por
            ahora, las cuentas del estudio las crea quien administra el sistema.
          </AlertDescription>
        </Alert>
        <RolesGuide />
      </div>
    </SettingsPage>
  );
}
