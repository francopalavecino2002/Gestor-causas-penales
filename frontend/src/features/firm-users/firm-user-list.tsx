import { useId } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/components/shell/user-initials";
import { ROLE_LABELS } from "@/features/auth/roles";
import { ArchivedBadge } from "@/features/cases/case-badges";
import type { FirmUser } from "@/features/firm-users/firm-users-api";
import { cn } from "@/lib/utils";

export type UserAction = "role" | "archive" | "restore" | "reset";

interface RowProps {
  user: FirmUser;
  /** The signed-in owner: their own account is changed in «Tu cuenta», not here. */
  isSelf: boolean;
  /** The restore of this user is on its way. */
  restoring: boolean;
  onAction: (action: UserAction, user: FirmUser) => void;
}

function Initials({ user }: { user: FirmUser }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-meta font-bold",
        user.archived ? "bg-secondary text-muted-foreground" : "bg-accent text-accent-foreground",
      )}
    >
      {initialsOf(user.displayName, user.email)}
    </span>
  );
}

/** The name (what labels the row and its buttons), and "Vos" on the owner's own account. */
function NameLine({ user, isSelf, nameId }: { user: FirmUser; isSelf: boolean; nameId: string }) {
  return (
    <>
      <span id={nameId}>{user.displayName}</span>
      {isSelf && (
        <Badge variant="neutral" className="ml-2 align-middle">
          Vos
        </Badge>
      )}
    </>
  );
}

/** What the owner should know about the account's state, when there is something to say. */
function UserBadges({ user }: { user: FirmUser }) {
  if (!user.archived && !user.passwordChangeRequired) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {user.archived && <ArchivedBadge />}
      {user.passwordChangeRequired && !user.archived && (
        <Badge variant="outline">
          <KeyRound aria-hidden="true" />
          Debe cambiar la contraseña
        </Badge>
      )}
    </span>
  );
}

function TwoFactorBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge variant="efectiva">
      <ShieldCheck aria-hidden="true" />
      Dos pasos activada
    </Badge>
  ) : (
    <Badge variant="neutral">
      <ShieldOff aria-hidden="true" />
      Dos pasos desactivada
    </Badge>
  );
}

/** What the owner can do with someone else's account; nothing on their own. */
function UserActions({
  user,
  isSelf,
  restoring,
  onAction,
  nameId,
  className,
}: RowProps & { nameId: string; className?: string }) {
  if (isSelf) {
    return (
      <p className={cn("text-meta text-muted-foreground", className)}>
        Tu cuenta: cambiá tu contraseña arriba, en «Tu cuenta».
      </p>
    );
  }
  if (user.archived) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <Button
          variant="outline"
          disabled={restoring}
          aria-describedby={nameId}
          onClick={() => onAction("restore", user)}
        >
          {restoring ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <ArchiveRestore aria-hidden="true" />
          )}
          Restaurá
        </Button>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="outline" aria-describedby={nameId} onClick={() => onAction("role", user)}>
        <UserCog aria-hidden="true" />
        Cambiá el rol
      </Button>
      <Button variant="outline" aria-describedby={nameId} onClick={() => onAction("reset", user)}>
        <KeyRound aria-hidden="true" />
        Contraseña temporal
      </Button>
      <Button variant="ghost" aria-describedby={nameId} onClick={() => onAction("archive", user)}>
        <Archive aria-hidden="true" />
        Archivá
      </Button>
    </div>
  );
}

/**
 * The same actions in a table row, behind one labeled button: three buttons per row would not fit
 * next to the person's data. Restoring stays a plain button, it is the only action there.
 */
function RowActionsMenu(props: RowProps & { nameId: string }) {
  const { user, isSelf, onAction, nameId } = props;
  if (isSelf || user.archived) {
    return <UserActions {...props} className="justify-end text-right" />;
  }
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-describedby={nameId}>
            Opciones
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onAction("role", user)}>
            <UserCog aria-hidden="true" />
            Cambiá el rol
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction("reset", user)}>
            <KeyRound aria-hidden="true" />
            Generá una contraseña temporal
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onAction("archive", user)}>
            <Archive aria-hidden="true" />
            Archivá la cuenta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** A person on phones and tablets: who, role and security, then the actions. */
function UserCard(props: RowProps) {
  const { user, isSelf } = props;
  const nameId = useId();
  return (
    <Card asChild className={cn(user.archived && "bg-secondary")}>
      <article aria-labelledby={nameId}>
        <CardHeader className="flex-nowrap justify-start gap-3">
          <Initials user={user} />
          <div className="grid min-w-0 flex-1 gap-1">
            <CardTitle as="h3" className="break-words">
              <NameLine user={user} isSelf={isSelf} nameId={nameId} />
            </CardTitle>
            <p className="text-meta break-all text-muted-foreground">{user.email}</p>
          </div>
        </CardHeader>
        <CardContent asChild>
          <dl className="grid gap-2 text-meta">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <dt className="text-muted-foreground">Rol</dt>
              <dd className="font-bold">{ROLE_LABELS[user.role]}</dd>
            </div>
            <div className="grid gap-1.5">
              <dt className="sr-only">Estado de la cuenta</dt>
              <dd className="flex flex-wrap gap-1.5">
                <TwoFactorBadge enabled={user.twoFactorEnabled} />
                <UserBadges user={user} />
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter className="border-t pt-3">
          <UserActions {...props} nameId={nameId} />
        </CardFooter>
      </article>
    </Card>
  );
}

export function UserCards({ users, ...rest }: ListProps) {
  return (
    <ul aria-label="Personas del estudio" className="grid gap-3 md:grid-cols-2">
      {users.map((user) => (
        <li key={user.id} className="grid">
          <UserCard user={user} {...rowProps(rest, user)} />
        </li>
      ))}
    </ul>
  );
}

interface ListProps {
  users: FirmUser[];
  selfId: string | undefined;
  restoringId: string | null;
  onAction: (action: UserAction, user: FirmUser) => void;
}

function rowProps({ selfId, restoringId, onAction }: Omit<ListProps, "users">, user: FirmUser) {
  return { isSelf: user.id === selfId, restoring: restoringId === user.id, onAction };
}

const headerCell = "px-4 py-3 text-left text-meta font-semibold text-muted-foreground";
const cell = "border-t px-4 py-3 align-top text-meta";

function UserRow(props: RowProps) {
  const { user, isSelf } = props;
  const nameId = useId();
  return (
    <tr className={cn(user.archived && "bg-secondary")}>
      <th scope="row" className={cn(cell, "pl-5 text-left font-normal")}>
        <span className="flex items-start gap-3">
          <Initials user={user} />
          <span className="grid min-w-0 gap-0.5">
            <span className="text-body font-bold">
              <NameLine user={user} isSelf={isSelf} nameId={nameId} />
            </span>
            <span className="break-all text-muted-foreground">{user.email}</span>
            <UserBadges user={user} />
          </span>
        </span>
      </th>
      <td className={cn(cell, "font-semibold whitespace-nowrap")}>{ROLE_LABELS[user.role]}</td>
      <td className={cell}>
        <TwoFactorBadge enabled={user.twoFactorEnabled} />
      </td>
      <td className={cn(cell, "pr-5")}>
        <RowActionsMenu {...props} nameId={nameId} />
      </td>
    </tr>
  );
}

/** From 1280 px: one person per row, the actions at the end. */
export function UserTable({ users, ...rest }: ListProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">Personas del estudio</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(headerCell, "pl-5")}>
              Persona
            </th>
            <th scope="col" className={headerCell}>
              Rol
            </th>
            <th scope="col" className={headerCell}>
              Verificación
            </th>
            <th scope="col" className={cn(headerCell, "pr-5 text-right")}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} {...rowProps(rest, user)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
