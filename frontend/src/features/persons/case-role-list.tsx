import { Link } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";

import type { CaseRole } from "@/features/persons/person-api";
import { isMaskedRole, sortCaseRoles } from "@/features/persons/person-format";
import { cn } from "@/lib/utils";

/**
 * The caption as a link to the case, or "Causa reservada" without one when the backend masked it
 * (a reserved case the user is not on the team of): the screen never guesses which case it is.
 */
export function CaseRoleCaption({ role, className }: { role: CaseRole; className?: string }) {
  if (isMaskedRole(role) || role.caseId === null) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
        <EyeOff aria-hidden="true" className="size-4.5 shrink-0" />
        Causa reservada
      </span>
    );
  }
  return (
    <Link
      to="/causas/$caseId"
      params={{ caseId: role.caseId }}
      className={cn("font-semibold text-primary underline-offset-4 hover:underline", className)}
    >
      {role.caption}
    </Link>
  );
}

/** Every case a person is in, with their role: "Imputado/a", "Víctima", "Testigo"... */
export function CaseRoleList({
  roles,
  empty = "No figura en ninguna causa.",
  className,
}: {
  roles: CaseRole[];
  empty?: string;
  className?: string;
}) {
  if (roles.length === 0) {
    return <p className="text-meta text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className={cn("grid gap-2.5 text-meta", className)}>
      {sortCaseRoles(roles).map((role, index) => (
        <li
          key={`${role.caseId ?? "reservada"}-${role.roleCode}-${index}`}
          className="grid min-w-0 gap-0.5"
        >
          <CaseRoleCaption role={role} className="min-w-0 break-words" />
          <span className="text-muted-foreground">
            {role.roleName}
            {role.caseArchived && " (causa archivada)"}
          </span>
        </li>
      ))}
    </ul>
  );
}
