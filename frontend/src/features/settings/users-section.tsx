import { useId } from "react";
import { ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/components/shell/user-initials";
import { ChangePasswordButton } from "@/features/account/change-password-dialog";
import { useMe } from "@/features/auth/me-query";
import { ROLE_LABELS } from "@/features/auth/roles";
import { FirmUsersSection } from "@/features/firm-users/firm-users-section";
import { ROLE_DESCRIPTIONS, ROLE_ORDER } from "@/features/settings/settings-copy";
import { SettingsPage } from "@/features/settings/settings-layout";
import { TwoFactorSection } from "@/features/two-factor/two-factor-section";

/** Who is signed in, with which role, whether the second step is on, and the password change. */
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
      <div className="grid gap-4 rounded-xl border bg-card px-4 py-4">
        <div className="grid gap-4 sm:flex sm:items-start">
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
        <div className="grid gap-2 border-t pt-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="max-w-prose text-meta text-muted-foreground">
            Al cambiarla se cierra tu sesión en todos tus dispositivos.
          </p>
          <ChangePasswordButton />
        </div>
      </div>
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
 * `/ajustes/usuarios`: the member's own account (password and second factor), the people of the
 * firm (the owner manages them, ADR-0044) and what each role can do.
 */
export function UsersSection() {
  return (
    <SettingsPage
      section="/ajustes/usuarios"
      intro="Tu cuenta, su verificación en dos pasos, las personas del estudio y los permisos de cada rol."
    >
      <div className="grid gap-7">
        <div className="grid max-w-3xl gap-7">
          <AccountCard />
          <TwoFactorSection />
        </div>
        <div className="max-w-5xl">
          <FirmUsersSection />
        </div>
        <div className="max-w-3xl">
          <RolesGuide />
        </div>
      </div>
    </SettingsPage>
  );
}
