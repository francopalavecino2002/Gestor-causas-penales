import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { FolderOpen, IdCard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchivedBadge } from "@/features/cases/case-badges";
import type { CaseRole, PersonListItem } from "@/features/persons/person-api";
import { ClientBadge, LegalEntityBadge, PersonKindIcon } from "@/features/persons/person-badges";
import {
  countCaseRoles,
  documentLabel,
  isMaskedRole,
  sortCaseRoles,
} from "@/features/persons/person-format";
import { cn } from "@/lib/utils";

/** How many roles a row shows before "y N causas más". */
const ROLES_SHOWN = 2;

/** "Imputado/a en Modelo, Carla s/ robo", or "Testigo en una causa reservada" when masked. */
function roleLine(role: CaseRole): string {
  const where = isMaskedRole(role) ? "una causa reservada" : role.caption;
  return `${role.roleName} en ${where}${role.caseArchived ? " (archivada)" : ""}`;
}

/** The first roles in words; the rest as a count. Plain text: the detail has the links. */
function RolesSummary({ roles }: { roles: CaseRole[] }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">Sin causas</span>;
  }
  const sorted = sortCaseRoles(roles);
  const rest = sorted.length - ROLES_SHOWN;
  return (
    <span className="grid min-w-0 gap-0.5">
      {sorted.slice(0, ROLES_SHOWN).map((role, index) => (
        <span
          key={`${role.caseId ?? "reservada"}-${role.roleCode}-${index}`}
          className="break-words"
        >
          {roleLine(role)}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground">
          y {rest === 1 ? "1 causa más" : `${countCaseRoles(rest)} más`}
        </span>
      )}
    </span>
  );
}

function PersonFlags({ person }: { person: PersonListItem }) {
  if (!person.clientId && person.kind !== "LEGAL" && !person.archived) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {person.clientId && <ClientBadge />}
      <LegalEntityBadge kind={person.kind} />
      {person.archived && <ArchivedBadge />}
    </span>
  );
}

function PersonLink({
  person,
  stretched = false,
}: {
  person: PersonListItem;
  stretched?: boolean;
}) {
  return (
    <Link
      to="/personas/$personId"
      params={{ personId: person.id }}
      className={cn(
        "underline-offset-4 hover:underline",
        stretched && "after:absolute after:inset-0 after:rounded-xl after:content-['']",
      )}
    >
      {person.displayName}
    </Link>
  );
}

function DocumentText({ person }: { person: PersonListItem }) {
  const label = documentLabel(person.documentType, person.documentNumber);
  return label ? (
    <span className="whitespace-nowrap tabular-nums">{label}</span>
  ) : (
    <span className="text-muted-foreground">Sin documento</span>
  );
}

/** A person on phones and tablets: name and flags, document, then where they appear. */
function PersonCard({ person }: { person: PersonListItem }) {
  const titleId = useId();
  return (
    <Card asChild className="relative transition-colors duration-fast ease-out hover:bg-accent">
      <article aria-labelledby={titleId}>
        <CardHeader>
          <CardTitle as="h2" id={titleId} className="flex min-w-0 items-start gap-2">
            <PersonKindIcon kind={person.kind} className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="min-w-0 break-words">
              <PersonLink person={person} stretched />
            </span>
          </CardTitle>
          <PersonFlags person={person} />
        </CardHeader>
        <CardContent asChild>
          <dl className="text-meta">
            <div className="flex min-w-0 items-start gap-2">
              <dt className="sr-only">Documento</dt>
              <IdCard
                aria-hidden="true"
                className="mt-0.75 size-4.5 shrink-0 text-muted-foreground"
              />
              <dd className="min-w-0">
                <DocumentText person={person} />
              </dd>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <dt className="sr-only">Causas</dt>
              <FolderOpen
                aria-hidden="true"
                className="mt-0.75 size-4.5 shrink-0 text-muted-foreground"
              />
              <dd className="min-w-0">
                <RolesSummary roles={person.caseRoles} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </article>
    </Card>
  );
}

export function PersonCards({ items }: { items: PersonListItem[] }) {
  return (
    <ul aria-label="Personas" className="grid gap-3 md:grid-cols-2">
      {items.map((person) => (
        <li key={person.id} className="grid">
          <PersonCard person={person} />
        </li>
      ))}
    </ul>
  );
}

const headerCell = "px-4 py-3 text-left text-meta font-semibold text-muted-foreground";
const cell = "border-t px-4 py-3 align-top text-meta";

/** From 1024 px: one person per row, same data as the cards plus the phone. */
export function PersonTable({ items, caption }: { items: PersonListItem[]; caption: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(headerCell, "pl-5")}>
              Persona
            </th>
            <th scope="col" className={headerCell}>
              Documento
            </th>
            <th scope="col" className={headerCell}>
              Causas y roles
            </th>
            <th scope="col" className={headerCell}>
              Teléfono
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((person) => (
            <tr
              key={person.id}
              className="transition-colors duration-fast ease-out hover:bg-accent"
            >
              <th scope="row" className={cn(cell, "pl-5 text-left font-normal")}>
                <span className="grid justify-items-start gap-1.5">
                  <span className="flex items-start gap-2 text-body font-bold">
                    <PersonKindIcon
                      kind={person.kind}
                      className="mt-0.75 size-4.5 shrink-0 text-primary"
                    />
                    <PersonLink person={person} />
                  </span>
                  <PersonFlags person={person} />
                </span>
              </th>
              <td className={cell}>
                <DocumentText person={person} />
              </td>
              <td className={cn(cell, "max-w-md")}>
                <RolesSummary roles={person.caseRoles} />
              </td>
              <td className={cell}>
                {person.phone ? (
                  <span className="whitespace-nowrap tabular-nums">{person.phone}</span>
                ) : (
                  <span className="text-muted-foreground">Sin cargar</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
