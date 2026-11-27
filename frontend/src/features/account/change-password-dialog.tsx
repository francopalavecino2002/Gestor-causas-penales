import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordChangeForm } from "@/features/account/password-change-form";
import { GuardedDialog } from "@/features/two-factor/two-factor-dialog";

/** "Cambiá tu contraseña" in Tu cuenta: every role changes their own. */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  // Closing mid-request would hide whether the password changed: keep it open until it answers.
  useEffect(() => {
    closeGuardRef.current = pending ? () => true : null;
  }, [pending]);

  return (
    <>
      <Button variant="outline" className="w-full sm:w-fit" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" />
        Cambiá tu contraseña
      </Button>
      <GuardedDialog open={open} onOpenChange={setOpen} closeGuardRef={closeGuardRef}>
        <DialogHeader>
          <DialogTitle>Cambiá tu contraseña</DialogTitle>
          <DialogDescription>
            Al guardarla se cierra tu sesión en todos tus dispositivos, también en este. Después
            ingresás con la contraseña nueva.
          </DialogDescription>
        </DialogHeader>
        <PasswordChangeForm
          current="actual"
          submitLabel="Guardá la contraseña nueva"
          onPendingChange={setPending}
        >
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="w-full sm:w-fit" disabled={pending}>
              Cancelá
            </Button>
          </DialogClose>
        </PasswordChangeForm>
      </GuardedDialog>
    </>
  );
}
