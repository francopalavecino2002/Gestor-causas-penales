import { useId, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, KeyRound, LoaderCircle, LogOut, UserCog } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import type { Role } from "@/features/auth/auth-api";
import { ROLE_LABELS } from "@/features/auth/roles";
import type { FirmUser } from "@/features/firm-users/firm-users-api";
import { firmUserFailure } from "@/features/firm-users/firm-users-errors";
import {
  useArchiveFirmUser,
  useChangeFirmUserRole,
  useResetFirmUserPassword,
} from "@/features/firm-users/firm-users-queries";
import {
  roleChangeSchema,
  type RoleChangeInput,
  type RoleChangeOutput,
} from "@/features/firm-users/firm-user-schema";
import { RoleField } from "@/features/firm-users/role-field";
import { TemporaryPasswordPanel } from "@/features/firm-users/temporary-password-panel";
import { holdOpen, type CloseGuard } from "@/features/two-factor/close-guard";
import { StepTitle } from "@/features/two-factor/two-factor-dialog";
import { ServerError } from "@/features/two-factor/two-factor-fields";

/** Said before every change that ends the person's sessions, so nobody is surprised. */
function SignOutNote({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <LogOut aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function CancelButton({ disabled, label = "Cancelá" }: { disabled: boolean; label?: string }) {
  return (
    <DialogClose asChild>
      <Button variant="outline" size="lg" className="w-full sm:w-fit" disabled={disabled}>
        {label}
      </Button>
    </DialogClose>
  );
}

/** A new role for someone else. Their sessions end: they sign in again with the new role. */
export function RoleChangeFlow({
  user,
  onChanged,
}: {
  user: FirmUser;
  onChanged: (message: string) => void;
}) {
  const id = useId();
  const change = useChangeFirmUserRole();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RoleChangeInput, unknown, RoleChangeOutput>({
    resolver: zodResolver(roleChangeSchema),
    defaultValues: { role: user.role },
  });
  const role = useWatch({ control, name: "role" }) as Role;
  const unchanged = role === user.role;

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const updated = await change.mutateAsync({ id: user.id, role: values.role });
      onChanged(
        `Listo: ${updated.displayName} ahora tiene el rol ${ROLE_LABELS[updated.role]}. La próxima vez que ingrese ya lo va a tener.`,
      );
    } catch (error) {
      setFailure(firmUserFailure(error).message);
    }
  });

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>Cambiá el rol de {user.displayName}</StepTitle>
        <DialogDescription>
          Hoy tiene el rol {ROLE_LABELS[user.role]}. El rol decide qué causas ve y qué puede hacer.
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={submit} className="grid gap-5">
        <ServerError id={`${id}-server`}>{failure}</ServerError>
        <RoleField
          id={`${id}-role`}
          label="Rol nuevo"
          registration={register("role")}
          value={role}
          error={errors.role?.message}
        />
        <SignOutNote>
          Al guardar, {user.displayName} sale del sistema en todos sus dispositivos y vuelve a
          ingresar con su contraseña de siempre.
        </SignOutNote>
        <DialogFooter>
          <CancelButton disabled={isSubmitting} />
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-fit"
            disabled={isSubmitting || unchanged}
          >
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <UserCog aria-hidden="true" />
            )}
            Guardá el rol
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/** Archiving ends access and sessions; nothing is deleted and a restore gives access back. */
export function ArchiveFlow({
  user,
  onArchived,
}: {
  user: FirmUser;
  onArchived: (message: string) => void;
}) {
  const id = useId();
  const archive = useArchiveFirmUser();

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>¿Archivás la cuenta de {user.displayName}?</StepTitle>
        <DialogDescription>
          Deja de poder ingresar al sistema. No se borra nada: las causas, tareas y audiencias en
          las que figura quedan como están. Si vuelve al estudio, restaurá su cuenta y entra con su
          contraseña de siempre.
        </DialogDescription>
      </DialogHeader>
      <SignOutNote>
        Si ahora tiene el sistema abierto, se cierra en todos sus dispositivos.
      </SignOutNote>
      <ServerError id={`${id}-server`}>
        {archive.isError ? firmUserFailure(archive.error).message : null}
      </ServerError>
      <DialogFooter>
        <CancelButton disabled={archive.isPending} />
        <Button
          size="lg"
          className="w-full sm:w-fit"
          disabled={archive.isPending}
          onClick={() =>
            archive.mutate(
              { id: user.id, archive: true },
              {
                onSuccess: (updated) =>
                  onArchived(
                    `Archivaste la cuenta de ${updated.displayName}. Ya no puede ingresar; la encontrás entre las archivadas.`,
                  ),
              },
            )
          }
        >
          {archive.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Archive aria-hidden="true" />
          )}
          Archivá la cuenta
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * A new temporary password for someone who forgot theirs: confirm, then show it once. The one they
 * used stops working and their sessions end.
 */
export function PasswordResetFlow({
  user,
  closeGuardRef,
  onReset,
  onClose,
}: {
  user: FirmUser;
  closeGuardRef: CloseGuard;
  onReset: (message: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const reset = useResetFirmUserPassword();
  const [password, setPassword] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const generate = async () => {
    setFailure(null);
    setPending(true);
    // Closing mid-request could replace the password without the new one reaching the screen.
    const release = holdOpen(closeGuardRef);
    try {
      const answer = await reset.mutateAsync(user.id);
      setPassword(answer.temporaryPassword);
      onReset(
        `Generaste una contraseña temporal nueva para ${user.displayName}. Al ingresar va a tener que elegir la suya.`,
      );
    } catch (error) {
      setFailure(firmUserFailure(error).message);
    } finally {
      release();
      setPending(false);
      // The password lives only in this dialog's state, never in the mutation cache.
      reset.reset();
    }
  };

  if (password) {
    return (
      <>
        <DialogHeader>
          <StepTitle focusOnMount>Contraseña temporal de {user.displayName}</StepTitle>
        </DialogHeader>
        <TemporaryPasswordPanel
          password={password}
          user={user}
          closeGuardRef={closeGuardRef}
          onDone={onClose}
          replaced
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>
          ¿Generás una contraseña temporal nueva para {user.displayName}?
        </StepTitle>
        <DialogDescription>
          Sirve si se olvidó la suya. La contraseña que usa ahora deja de funcionar y, al ingresar
          con la temporal, va a tener que elegir una nueva.
        </DialogDescription>
      </DialogHeader>
      <SignOutNote>
        Si ahora tiene el sistema abierto, se cierra en todos sus dispositivos.
      </SignOutNote>
      <ServerError id={`${id}-server`}>{failure}</ServerError>
      <DialogFooter>
        <CancelButton disabled={pending} />
        <Button
          size="lg"
          className="w-full sm:w-fit"
          disabled={pending}
          onClick={() => void generate()}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
          Generá la contraseña
        </Button>
      </DialogFooter>
    </>
  );
}
