import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FIRM_TIME_ZONE, localDay } from "@/features/agenda/agenda-dates";
import { useMe } from "@/features/auth/me-query";
import { ArchivedBadge } from "@/features/cases/case-badges";
import { formatNumericDate } from "@/features/cases/case-format";
import { LoadError } from "@/features/cases/case-states";
import { CaseRoleList } from "@/features/persons/case-role-list";
import { ClientSection } from "@/features/persons/client-section";
import type { PersonListItem } from "@/features/persons/person-api";
import { ClientBadge, LegalEntityBadge } from "@/features/persons/person-badges";
import { PersonFormDialog } from "@/features/persons/person-form-dialog";
import {
  canArchivePeople,
  countCaseRoles,
  distinctCases,
  documentLabel,
  PERSON_KIND_LABELS,
} from "@/features/persons/person-format";
import { usePersonOverview, useSetPersonArchived } from "@/features/persons/person-queries";
import { Missing, Section, TermList, type Term } from "@/features/persons/person-sections";
import { PersonDetailSkeleton, PersonNotFound } from "@/features/persons/person-states";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

function BackLink() {
  return (
    <Link
      to="/personas"
      className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-meta font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      Todas las personas
    </Link>
  );
}

function PersonDataCard({ person }: { person: PersonListItem }) {
  const human = person.kind === "HUMAN";
  const document = documentLabel(person.documentType, person.documentNumber);
  const terms: Term[] = [
    { term: "Tipo", value: PERSON_KIND_LABELS[person.kind] },
    {
      term: "Documento",
      value: document ? <span className="tabular-nums">{document}</span> : <Missing />,
    },
  ];
  if (human) {
    terms.push({
      term: "Fecha de nacimiento",
      value: person.birthDate ? (
        <span className="tabular-nums">{formatNumericDate(person.birthDate)}</span>
      ) : (
        <Missing />
      ),
    });
  }
  terms.push(
    { term: "Nacionalidad", value: person.nationality ?? <Missing /> },
    {
      term: "Teléfono",
      value: person.phone ? (
        <a
          href={`tel:${person.phone.replace(/[^\d+]/g, "")}`}
          className="text-primary tabular-nums underline-offset-4 hover:underline"
        >
          {person.phone}
        </a>
      ) : (
        <Missing />
      ),
    },
    {
      term: "Email",
      value: person.email ? (
        <a
          href={`mailto:${person.email}`}
          className="break-all text-primary underline-offset-4 hover:underline"
        >
          {person.email}
        </a>
      ) : (
        <Missing />
      ),
    },
    { term: "Domicilio", value: person.address ?? <Missing /> },
    {
      term: "Cargada el",
      value: (
        <time dateTime={person.createdAt} className="tabular-nums">
          {formatNumericDate(localDay(person.createdAt, FIRM_TIME_ZONE))}
        </time>
      ),
    },
  );
  return (
    <Card>
      <CardContent asChild>
        <TermList terms={terms} />
      </CardContent>
    </Card>
  );
}

function archiveError(error: unknown, archived: boolean): string {
  const what = archived ? "restauró" : "archivó";
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return `No hay conexión con el servidor, así que no se ${what} la persona. Revisá tu conexión y volvé a intentar.`;
    }
    if (error.status === 403) {
      return "No tenés permiso: archivan y restauran personas la persona titular del estudio y los abogados.";
    }
  }
  return `El servidor no respondió como esperábamos y no se ${what} la persona. Volvé a intentar en unos minutos.`;
}

function PersonScreen({ person }: { person: PersonListItem }) {
  const { data: me } = useMe();
  const canArchive = canArchivePeople(me);
  const setArchived = useSetPersonArchived(person.id);
  const [editing, setEditing] = useState(false);
  const roles = person.caseRoles;
  const document = documentLabel(person.documentType, person.documentNumber);
  const flags = person.clientId || person.kind === "LEGAL" || person.archived;

  return (
    <>
      <div className="grid gap-2">
        <BackLink />
        <header className="grid gap-2">
          {flags && (
            <p className="flex flex-wrap gap-1.5">
              {person.clientId && <ClientBadge />}
              <LegalEntityBadge kind={person.kind} />
              {person.archived && <ArchivedBadge />}
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="grid min-w-0 gap-1.5">
              <h1 className="text-display font-bold text-balance break-words">
                {person.displayName}
              </h1>
              <p className="flex flex-wrap gap-x-4 text-body text-muted-foreground">
                <span className="tabular-nums">{document ?? "Sin documento"}</span>
                {person.aliases && <span>También: {person.aliases}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Editá la persona
              </Button>
              {canArchive && (
                <Button
                  variant="ghost"
                  disabled={setArchived.isPending}
                  onClick={() => setArchived.mutate(!person.archived)}
                >
                  {person.archived ? (
                    <ArchiveRestore aria-hidden="true" />
                  ) : (
                    <Archive aria-hidden="true" />
                  )}
                  {person.archived ? "Restaurá la persona" : "Archivá la persona"}
                </Button>
              )}
            </div>
          </div>
        </header>
      </div>

      {setArchived.isError && (
        <Alert variant="error" role="alert">
          <Archive aria-hidden="true" />
          <AlertDescription>{archiveError(setArchived.error, person.archived)}</AlertDescription>
        </Alert>
      )}
      {person.archived && (
        <Alert variant="info">
          <Archive aria-hidden="true" />
          <AlertTitle>Esta persona está archivada</AlertTitle>
          <AlertDescription>
            Nada se borró: sigue en sus causas, pero no aparece en las búsquedas salvo que incluyas
            las archivadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-7 xl:grid-cols-with-aside xl:gap-10">
        <div className="grid content-start gap-7">
          <Section title="Causas y roles">
            <Card>
              {roles.length > 0 && (
                <p className="text-meta text-muted-foreground">
                  Figura en {countCaseRoles(distinctCases(roles))}.
                </p>
              )}
              <CaseRoleList
                roles={roles}
                empty="Todavía no figura en ninguna causa. Se agrega desde cada causa, como imputado/a o como parte."
              />
            </Card>
          </Section>
          <ClientSection person={person} />
        </div>
        <div className="grid content-start gap-7">
          <Section title="Datos">
            <PersonDataCard person={person} />
          </Section>
        </div>
      </div>

      {editing && <PersonFormDialog person={person} onClose={() => setEditing(false)} />}
    </>
  );
}

/**
 * `/personas/$personId`: who the person is, every case they are in with their role (a reserved
 * case they may not see shows as "Causa reservada", without a link), their data and, for a client,
 * the consent and the authorized contacts.
 */
export function PersonDetailPage({ personId }: { personId: string }) {
  const query = usePersonOverview(personId);
  if (query.isPending) return <PersonDetailSkeleton />;
  if (query.isError) {
    const status = isApiError(query.error) ? query.error.status : 0;
    if (status === 404 || status === 400) return <PersonNotFound />;
    return (
      <>
        <div className="grid gap-2">
          <BackLink />
          <PageHeader title="Persona" />
        </div>
        <LoadError
          title="No pudimos cargar a la persona"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }
  return <PersonScreen person={query.data} />;
}
