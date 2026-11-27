import { useEffect, useId, useRef, useState } from "react";
import { Copy, KeyRound, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMe } from "@/features/auth/me-query";
import { SavedStatus } from "@/features/settings/settings-layout";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import type { CloseGuard } from "@/features/two-factor/close-guard";

/**
 * A temporary password, shown once: what to hand over (password, firm and email), a copy button
 * and a box to confirm it was written down. Until it is ticked the dialog does not close and the
 * browser asks before leaving the page. The password lives only in the dialog's state.
 */
export function TemporaryPasswordPanel({
  password,
  user,
  closeGuardRef,
  onDone,
  replaced = false,
}: {
  password: string;
  user: { displayName: string; email: string };
  closeGuardRef: CloseGuard;
  onDone: () => void;
  /** A reset: the password they used until now stopped working. */
  replaced?: boolean;
}) {
  const id = useId();
  const { data: me } = useMe();
  const [saved, setSaved] = useState(false);
  const [warned, setWarned] = useState(false);
  const [copyMessage, announceCopy] = useAnnouncement();
  const [copyFailed, setCopyFailed] = useState(false);
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    closeGuardRef.current = () => {
      if (saved) return false;
      setWarned(true);
      checkboxRef.current?.focus();
      return true;
    };
    return () => {
      closeGuardRef.current = null;
    };
  }, [closeGuardRef, saved]);

  // Reloading or leaving the page would lose the password for good: let the browser ask first.
  useEffect(() => {
    if (saved) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [saved]);

  const copy = async () => {
    announceCopy(null);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(password);
      announceCopy("Copiaste la contraseña. Pegala solo donde la vayas a dar.");
    } catch {
      // No clipboard (an old browser, no permission): select it to copy it by hand.
      if (passwordRef.current) window.getSelection()?.selectAllChildren(passwordRef.current);
      setCopyFailed(true);
    }
  };

  const finish = () => {
    if (closeGuardRef.current?.()) return;
    onDone();
  };

  return (
    <div className="grid gap-5">
      <Alert>
        <KeyRound aria-hidden="true" />
        <AlertTitle>Se muestra una sola vez</AlertTitle>
        <AlertDescription>
          <p>
            Dásela en persona o por un canal seguro; al ingresar va a tener que elegir la suya.
            {replaced && " La contraseña que usaba hasta ahora ya no funciona."}
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-lg border bg-secondary px-4 py-3.5">
        <div className="grid gap-1">
          <p className="text-meta font-semibold text-muted-foreground">Contraseña temporal</p>
          <p
            ref={passwordRef}
            className="text-title font-bold tracking-wide break-all tabular-nums select-all"
          >
            {password}
          </p>
        </div>
        <dl className="grid gap-x-6 gap-y-1 border-t pt-3 text-meta sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Estudio</dt>
          <dd className="font-semibold break-all">{me?.tenant.slug}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-semibold break-all">{user.email}</dd>
        </dl>
      </div>

      <div className="grid gap-2">
        <Button variant="outline" className="w-full sm:w-fit" onClick={() => void copy()}>
          <Copy aria-hidden="true" />
          Copiá la contraseña
        </Button>
        <SavedStatus message={copyMessage} />
        {copyFailed && (
          <p role="alert" className="text-meta font-semibold text-foreground">
            No pudimos copiarla sola. La contraseña quedó seleccionada: copiala con Ctrl+C, o en el
            celular mantenela apretada y elegí Copiar.
          </p>
        )}
      </div>

      <div className="grid gap-3 border-t pt-4">
        <div className="flex min-h-11 items-start gap-3">
          <Checkbox
            ref={checkboxRef}
            id={`${id}-saved`}
            checked={saved}
            onCheckedChange={(checked) => {
              setSaved(checked === true);
              if (checked === true) setWarned(false);
            }}
            aria-describedby={warned ? `${id}-warning` : undefined}
            className="mt-0.5"
          />
          <Label htmlFor={`${id}-saved`} className="text-body font-semibold">
            Ya la anoté
          </Label>
        </div>
        {warned && (
          <Alert id={`${id}-warning`} variant="error" role="alert">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              Antes de cerrar, anotá o copiá la contraseña de {user.displayName} y marcá «Ya la
              anoté». Después no la vamos a poder mostrar de nuevo.
            </AlertDescription>
          </Alert>
        )}
        <Button size="lg" className="w-full sm:w-fit sm:justify-self-end" onClick={finish}>
          Listo
        </Button>
      </div>
    </div>
  );
}
