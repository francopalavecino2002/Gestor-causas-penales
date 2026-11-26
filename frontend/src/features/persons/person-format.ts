import type { Me, Role } from "@/features/auth/auth-api";
import type { CaseRole, DocumentType, PersonKind } from "@/features/persons/person-api";
import { DOCUMENT_TYPE_LABELS } from "@/features/persons/person-schema";

export const PERSON_KIND_LABELS: Record<PersonKind, string> = {
  HUMAN: "Persona humana",
  LEGAL: "Persona jurídica",
};

/** "DNI 99000111", or null without a document. */
export function documentLabel(type: DocumentType | null, number: string | null): string | null {
  if (!type || !number) return null;
  return `${DOCUMENT_TYPE_LABELS[type]} ${number}`;
}

/** "1 persona", "12 personas". */
export function countPersons(count: number): string {
  return `${count} ${count === 1 ? "persona" : "personas"}`;
}

/** "1 causa", "3 causas". */
export function countCaseRoles(count: number): string {
  return `${count} ${count === 1 ? "causa" : "causas"}`;
}

/** Under the other persons who share a client's document (the client view has no disclaimer). */
export const CLIENT_CONFLICT_NOTE =
  "Alerta simple por número de documento: revisá esas causas antes de seguir con el caso.";

const ARCHIVE_ROLES: readonly Role[] = ["OWNER", "LAWYER"];

/** Archiving and restoring persons and clients is for the owner and the lawyers (backend 403). */
export function canArchivePeople(me: Pick<Me, "role"> | null | undefined): boolean {
  return !!me && ARCHIVE_ROLES.includes(me.role);
}

/** A case the user may not see: the backend masks it, so the screen does not link it. */
export function isMaskedRole(role: CaseRole): boolean {
  return role.reserved && (role.caseId === null || role.caption === null);
}

/** How many cases the roles are in: one person can have two roles in the same case. */
export function distinctCases(roles: CaseRole[]): number {
  return new Set(roles.map((role, index) => role.caseId ?? `reservada-${index}`)).size;
}

/** Visible cases first, by caption; masked ones at the end. */
export function sortCaseRoles(roles: CaseRole[]): CaseRole[] {
  return [...roles].sort((a, b) => {
    const masked = Number(isMaskedRole(a)) - Number(isMaskedRole(b));
    if (masked !== 0) return masked;
    return (a.caption ?? "").localeCompare(b.caption ?? "", "es-AR");
  });
}
