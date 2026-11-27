import { useId, useRef, useState } from "react";
import { CircleAlert, Info, UserPlus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth/me-query";
import type { FirmUser } from "@/features/firm-users/firm-users-api";
import { firmUserFailure } from "@/features/firm-users/firm-users-errors";
import { useArchiveFirmUser, useFirmUsers } from "@/features/firm-users/firm-users-queries";
import { UserCards, UserTable, type UserAction } from "@/features/firm-users/firm-user-list";
import { NewUserFlow } from "@/features/firm-users/new-user-flow";
import {
  ArchiveFlow,
  PasswordResetFlow,
  RoleChangeFlow,
} from "@/features/firm-users/user-action-flows";
import { SavedStatus } from "@/features/settings/settings-layout";
import { useAnnouncement } from "@/features/settings/settings-hooks";
import { GuardedDialog } from "@/features/two-factor/two-factor-dialog";
import { useMediaQuery } from "@/lib/use-media-query";

type DialogState = { kind: "create" } | { kind: "role" | "archive" | "reset"; user: FirmUser };

const TITLE_ID = "personas-del-estudio";

/**
 * «Personas del estudio» in Ajustes → Usuarios (ADR-0044). The owner adds people with a temporary
 * password, changes roles, archives and restores (nobody is deleted) and gives a new temporary
 * password to whoever forgot theirs. The other roles only read who manages it.
 */
export function FirmUsersSection() {
  const { data: me } = useMe();
  if (me?.role !== "OWNER") return <ManagedByOwner />;
  return <OwnerUsers selfId={me.id} />;
}

function ManagedByOwner() {
  return (
    <section aria-labelledby={TITLE_ID} className="grid gap-3">
      <h2 id={TITLE_ID} className="text-title font-bold">
        Personas del estudio
      </h2>
      <p className="flex max-w-prose items-start gap-2.5 rounded-xl border bg-card px-4 py-3.5 text-body">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <span>
          Las cuentas del equipo las maneja la persona titular del estudio: pedile a ella que sume a
          alguien, cambie un rol o te dé una contraseña temporal si te olvidaste la tuya.
        </span>
      </p>
    </section>
  );
}

function OwnerUsers({ selfId }: { selfId: string }) {
  const switchId = useId();
  const users = useFirmUsers();
  const restore = useArchiveFirmUser();
  // The table needs the room of a wide screen next to the sidebar; below, two columns of cards.
  const wide = useMediaQuery("(min-width: 80rem)");
  const [showArchived, setShowArchived] = useState(false);
  const [message, announce] = useAnnouncement();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  /** The last dialog, kept while it animates out so its content does not flip. */
  const [shown, setShown] = useState<DialogState>({ kind: "create" });
  const changedRef = useRef(false);
  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const open = (next: DialogState) => {
    changedRef.current = false;
    announce(null);
    setRestoreError(null);
    setShown(next);
    setDialog(next);
  };
  const close = () => setDialog(null);
  const changed = (text: string) => {
    changedRef.current = true;
    announce(text);
  };
  const changedAndClose = (text: string) => {
    changed(text);
    close();
  };

  const act = (action: UserAction, user: FirmUser) => {
    if (action !== "restore") {
      open({ kind: action, user });
      return;
    }
    announce(null);
    setRestoreError(null);
    restore.mutate(
      { id: user.id, archive: false },
      {
        onSuccess: (updated) => {
          announce(
            `Restauraste la cuenta de ${updated.displayName}. Ya puede ingresar con su contraseña de siempre.`,
          );
          headingRef.current?.focus();
        },
        onError: (error) => setRestoreError(firmUserFailure(error).message),
      },
    );
  };

  const all = users.data ?? [];
  const archivedCount = all.filter((user) => user.archived).length;
  const visible = showArchived ? all : all.filter((user) => !user.archived);
  const alone = users.isSuccess && !all.some((user) => user.id !== selfId && !user.archived);
  const listProps = {
    users: visible,
    selfId,
    restoringId: restore.isPending ? (restore.variables?.id ?? null) : null,
    onAction: act,
  };

  return (
    <section aria-labelledby={TITLE_ID} className="grid scroll-mt-24 gap-4">
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h2 ref={headingRef} id={TITLE_ID} tabIndex={-1} className="text-title font-bold">
            Personas del estudio
          </h2>
          <p className="max-w-prose text-meta text-muted-foreground">
            Quiénes ingresan al sistema y con qué rol. Nadie se borra: si alguien deja el estudio,
            archivá su cuenta.
          </p>
        </div>
        <Button className="w-full sm:w-fit sm:shrink-0" onClick={() => open({ kind: "create" })}>
          <UserPlus aria-hidden="true" />
          Sumá una persona
        </Button>
      </div>

      <SavedStatus message={message} />
      {restoreError && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{restoreError}</AlertDescription>
        </Alert>
      )}

      {users.isPending ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Cargando las personas del estudio"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-1"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 rounded-xl xl:h-20" />
          ))}
        </div>
      ) : users.isError ? (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos cargar las personas del estudio</AlertTitle>
          <AlertDescription>
            <p>{firmUserFailure(users.error).message}</p>
            <Button variant="outline" className="mt-2 w-fit" onClick={() => void users.refetch()}>
              Volvé a intentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {archivedCount > 0 && (
            <div className="flex min-h-11 items-center gap-3">
              <Switch id={switchId} checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor={switchId} className="cursor-pointer">
                Mostrá las archivadas ({archivedCount})
              </Label>
            </div>
          )}
          {wide ? <UserTable {...listProps} /> : <UserCards {...listProps} />}
          {alone && (
            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>
                Por ahora sos la única persona con cuenta. Sumá a quienes trabajan con vos para
                compartir la agenda, las causas y las tareas.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

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
        {shown.kind === "create" && (
          <NewUserFlow
            closeGuardRef={closeGuardRef}
            onCreated={(name) =>
              changed(
                `Creaste la cuenta de ${name}. Al ingresar con la contraseña temporal va a elegir la suya.`,
              )
            }
            onClose={close}
          />
        )}
        {shown.kind === "role" && (
          <RoleChangeFlow key={shown.user.id} user={shown.user} onChanged={changedAndClose} />
        )}
        {shown.kind === "archive" && (
          <ArchiveFlow key={shown.user.id} user={shown.user} onArchived={changedAndClose} />
        )}
        {shown.kind === "reset" && (
          <PasswordResetFlow
            key={shown.user.id}
            user={shown.user}
            closeGuardRef={closeGuardRef}
            onReset={changed}
            onClose={close}
          />
        )}
      </GuardedDialog>
    </section>
  );
}
