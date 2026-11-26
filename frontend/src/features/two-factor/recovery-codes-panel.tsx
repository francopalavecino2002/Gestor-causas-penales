import { useEffect, useId, useRef, useState } from "react";
import { Copy, Download, KeyRound, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMe } from "@/features/auth/me-query";
import { SavedStatus } from "@/features/settings/settings-layout";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import {
  RECOVERY_CODES_FILE_NAME,
  recoveryCodesFile,
  recoveryCodesList,
} from "@/features/two-factor/two-factor-format";
import type { CloseGuard } from "@/features/two-factor/close-guard";
import { saveBlob } from "@/lib/download";

/**
 * The ten recovery codes, shown once: download, copy, and a box to confirm they were saved. Until
 * it is ticked the dialog does not close and the browser asks before leaving the page.
 */
export function RecoveryCodesPanel({
  codes,
  closeGuardRef,
  onDone,
  replaced = false,
}: {
  codes: string[];
  closeGuardRef: CloseGuard;
  onDone: () => void;
  /** New codes that replace older ones: say the old ones stopped working. */
  replaced?: boolean;
}) {
  const id = useId();
  const { data: me } = useMe();
  const [saved, setSaved] = useState(false);
  const [warned, setWarned] = useState(false);
  const [copyMessage, announceCopy] = useAnnouncement();
  const [copyFailed, setCopyFailed] = useState(false);
  const checkboxRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

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

  // Reloading or leaving the page would lose the codes for good: let the browser ask first.
  useEffect(() => {
    if (saved) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [saved]);

  const download = () => {
    const text = recoveryCodesFile(
      codes,
      { email: me?.email ?? "", firm: me?.tenant.name ?? "" },
      new Date(),
    );
    saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), RECOVERY_CODES_FILE_NAME);
    announceCopy("Descargaste los códigos. Guardá el archivo en un lugar seguro.");
  };

  const copy = async () => {
    announceCopy(null);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(recoveryCodesList(codes));
      announceCopy("Copiaste los códigos. Pegalos en un lugar seguro.");
    } catch {
      // No clipboard (an old browser, no permission): select the list to copy it by hand.
      const list = listRef.current;
      if (list) window.getSelection()?.selectAllChildren(list);
      setCopyFailed(true);
    }
  };

  const finish = () => {
    if (closeGuardRef.current?.()) return;
    onDone();
  };

  return (
    <div className="grid gap-5">
      <Alert variant="deadline">
        <KeyRound aria-hidden="true" />
        <AlertTitle>Se muestran una sola vez</AlertTitle>
        <AlertDescription>
          <p>
            Si perdés el celular, cada código te deja ingresar una vez sin la app.{" "}
            {replaced
              ? "Los códigos que tenías antes ya no funcionan."
              : "Guardalos fuera del celular: impresos o en un gestor de contraseñas."}
          </p>
        </AlertDescription>
      </Alert>

      <ol
        ref={listRef}
        aria-label="Códigos de recuperación"
        className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border bg-secondary px-4 py-3.5 sm:grid-cols-2"
      >
        {codes.map((code, index) => (
          <li key={code} className="flex items-baseline gap-2.5 text-body tabular-nums">
            <span aria-hidden="true" className="w-5 text-right text-small text-muted-foreground">
              {index + 1}
            </span>
            <span className="font-bold tracking-wide whitespace-nowrap select-all">{code}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={download}>
            <Download aria-hidden="true" />
            Descargá los códigos
          </Button>
          <Button variant="outline" onClick={() => void copy()}>
            <Copy aria-hidden="true" />
            Copiá los códigos
          </Button>
        </div>
        <SavedStatus message={copyMessage} />
        {copyFailed && (
          <p role="alert" className="text-meta font-semibold text-foreground">
            No pudimos copiarlos solos. La lista quedó seleccionada: copiala con Ctrl+C, o en el
            celular mantenela apretada y elegí Copiar.
          </p>
        )}
      </div>

      <div className="grid gap-3 border-t pt-4">
        <div className="flex items-start gap-3">
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
            Ya los guardé en un lugar seguro
          </Label>
        </div>
        {warned && (
          <Alert id={`${id}-warning`} variant="error" role="alert">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              Antes de cerrar, descargá o copiá los códigos y marcá «Ya los guardé en un lugar
              seguro». Después no los vamos a poder mostrar de nuevo.
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
