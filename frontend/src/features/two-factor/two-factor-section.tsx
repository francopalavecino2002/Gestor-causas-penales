import { useRef, useState } from "react";
import { CircleAlert, KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedStatus } from "@/features/settings/settings-layout";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import { DisableFlow } from "@/features/two-factor/disable-dialog";
import { EnrollFlow } from "@/features/two-factor/enroll-dialog";
import { RegenerateFlow } from "@/features/two-factor/regenerate-dialog";
import { GuardedDialog } from "@/features/two-factor/two-factor-dialog";
import { LOW_RECOVERY_CODES, TWO_FACTOR_ANCHOR } from "@/features/two-factor/two-factor-format";
import { useTwoFactorStatus } from "@/features/two-factor/two-factor-queries";

type DialogKind = "enroll" | "regenerate" | "disable";

function remainingLabel(count: number): string {
  if (count === 0) return "No te quedan códigos de recuperación sin usar.";
  return count === 1
    ? "Te queda 1 código de recuperación sin usar."
    : `Te quedan ${count} códigos de recuperación sin usar.`;
}

/**
 * `Verificación en dos pasos` in Ajustes → Usuarios: turn it on with the authenticator app, see
 * how many recovery codes are left, get new ones, or turn it off (ADR-0009).
 */
export function TwoFactorSection() {
  const status = useTwoFactorStatus();
  const [message, announce] = useAnnouncement();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  /** The last dialog, kept while it animates out so its content does not flip. */
  const [shown, setShown] = useState<DialogKind>("enroll");
  /** Something changed in the dialog: focus then goes to the section, the trigger may be gone. */
  const changedRef = useRef(false);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const open = (kind: DialogKind) => {
    changedRef.current = false;
    announce(null);
    setShown(kind);
    setDialog(kind);
  };
  const close = () => setDialog(null);
  const changed = (text: string) => {
    changedRef.current = true;
    announce(text);
  };

  const data = status.data;

  return (
    <section
      id={TWO_FACTOR_ANCHOR}
      aria-labelledby={`${TWO_FACTOR_ANCHOR}-title`}
      className="grid scroll-mt-24 gap-3"
    >
      <h2
        ref={headingRef}
        id={`${TWO_FACTOR_ANCHOR}-title`}
        tabIndex={-1}
        className="text-title font-bold"
      >
        Verificación en dos pasos
      </h2>

      {status.isPending ? (
        <Skeleton className="h-44 rounded-xl" />
      ) : status.isError || !data ? (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos ver si la tenés activada</AlertTitle>
          <AlertDescription>
            <p>Revisá tu conexión y volvé a intentar.</p>
            <Button variant="outline" className="mt-2 w-fit" onClick={() => void status.refetch()}>
              Volvé a intentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 rounded-xl border bg-card p-4 md:p-6">
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className={
                data.enabled
                  ? "inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-status-efectiva-soft text-status-efectiva"
                  : "inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
              }
            >
              {data.enabled ? <ShieldCheck className="size-6" /> : <ShieldOff className="size-6" />}
            </span>
            <div className="grid min-w-0 gap-1.5">
              {data.enabled ? (
                <Badge variant="efectiva">Activada</Badge>
              ) : (
                <Badge variant="deadline">
                  <ShieldOff aria-hidden="true" />
                  Desactivada
                </Badge>
              )}
              <p className="max-w-prose text-body">
                {data.enabled
                  ? "Al ingresar, además de la contraseña te pedimos el código de 6 números de tu app de autenticación."
                  : "Al ingresar, además de la contraseña te pedimos un código de 6 números que genera tu celular. Así, aunque alguien conozca tu contraseña, no puede entrar a las causas."}
              </p>
            </div>
          </div>

          <SavedStatus message={message} />

          {data.enabled ? (
            <>
              <RecoveryCodesSummary remaining={data.recoveryCodesRemaining} />
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
                <Button variant="outline" onClick={() => open("regenerate")}>
                  <RefreshCw aria-hidden="true" />
                  Generá códigos nuevos
                </Button>
                <Button variant="ghost" onClick={() => open("disable")}>
                  Desactivá la verificación
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="max-w-prose text-meta text-muted-foreground">
                Te toma dos minutos. Necesitás tu celular con una app de autenticación: Google
                Authenticator, Microsoft Authenticator o cualquier app de códigos TOTP.
              </p>
              <Button className="w-full sm:w-fit" onClick={() => open("enroll")}>
                Activá la verificación en dos pasos
              </Button>
            </>
          )}
        </div>
      )}

      {/* Outside the branches above: enabling or disabling must not unmount the open dialog. */}
      <GuardedDialog
        open={dialog !== null}
        onOpenChange={(next) => (next ? undefined : close())}
        closeGuardRef={closeGuardRef}
        onCloseAutoFocus={(event) => {
          if (!changedRef.current) return;
          event.preventDefault();
          headingRef.current?.focus();
        }}
      >
        {shown === "enroll" && (
          <EnrollFlow
            closeGuardRef={closeGuardRef}
            onEnabled={() => changed("Listo: activaste la verificación en dos pasos.")}
            onClose={close}
          />
        )}
        {shown === "regenerate" && (
          <RegenerateFlow
            closeGuardRef={closeGuardRef}
            onRegenerated={() =>
              changed("Listo: generaste códigos nuevos. Los anteriores ya no funcionan.")
            }
            onClose={close}
          />
        )}
        {shown === "disable" && (
          <DisableFlow
            closeGuardRef={closeGuardRef}
            onDisabled={() => {
              changed("Listo: desactivaste la verificación en dos pasos.");
              close();
            }}
          />
        )}
      </GuardedDialog>
    </section>
  );
}

function RecoveryCodesSummary({ remaining }: { remaining: number }) {
  if (remaining <= LOW_RECOVERY_CODES) {
    return (
      <Alert variant="deadline">
        <KeyRound aria-hidden="true" />
        <AlertTitle>{remainingLabel(remaining)}</AlertTitle>
        <AlertDescription>
          <p>
            Generá códigos nuevos antes de quedarte sin ninguno: son la forma de entrar si perdés el
            celular.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <p className="flex max-w-prose items-start gap-2 text-meta">
      <KeyRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <span>
        {remainingLabel(remaining)}{" "}
        <span className="text-muted-foreground">
          Si perdés el celular, usá uno para entrar. Cada código sirve una vez.
        </span>
      </span>
    </p>
  );
}
