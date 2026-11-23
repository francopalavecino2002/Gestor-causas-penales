import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, Info, Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { FIRM_TIME_ZONE, localDay, todayIn } from "@/features/agenda/agenda-dates";
import { cppArticle } from "@/features/agenda/agenda-format";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import { useNow } from "@/features/agenda/use-now";
import { useCatalogItems, useCatalogsSettled } from "@/features/catalogs/catalog-queries";
import type { CatalogId } from "@/features/catalogs/catalog-types";
import { ArchivedBadge, DetaineeBadge, ReservedBadge } from "@/features/cases/case-badges";
import {
  ACTION_TYPE_LABELS,
  countDefendants,
  formatLongDateTime,
  formatNumericDate,
  REPRESENTATION_LABELS,
  TEAM_ROLE_LABELS,
} from "@/features/cases/case-format";
import { useMe } from "@/features/auth/me-query";
import { CaseDeadlines } from "@/features/cases/case-deadlines";
import { CaseFormDialog } from "@/features/cases/case-form-dialog";
import { caseRights } from "@/features/cases/case-rights";
import { DefendantFormDialog } from "@/features/cases/defendant-form-dialog";
import { HearingEditContext } from "@/features/hearings/hearing-edit-context";
import { HearingFormDialog } from "@/features/hearings/hearing-form-dialog";
import { CaseHearings } from "@/features/cases/case-hearings";
import { useCase } from "@/features/cases/case-queries";
import { CaseDetailSkeleton, CaseNotFound, LoadError } from "@/features/cases/case-states";
import type { CaseDetail, DefendantView, TeamRole } from "@/features/cases/case-types";
import { DefendantCard } from "@/features/cases/defendant-card";
import { isApiError } from "@/lib/api";

const DETAIL_CATALOGS: CatalogId[] = ["stages", "hearing-types", "liberty-situations"];

function BackLink() {
  return (
    <Link
      to="/causas"
      className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-meta font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      Todas las causas
    </Link>
  );
}

/** A titled block of the page; `h2` so the outline reads Causa > Imputados > (each one). */
function Section({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** A button next to the title, e.g. "Agregá un imputado". */
  action?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className ?? "grid content-start gap-3"}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-title font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface Term {
  term: string;
  value: ReactNode;
}

function TermList({ terms, className }: { terms: Term[]; className?: string }) {
  return (
    <dl className={className ?? "grid gap-x-6 gap-y-3 text-meta"}>
      {terms.map(({ term, value }) => (
        <div key={term} className="grid min-w-0 content-start">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const missing = <span className="text-muted-foreground">Sin cargar</span>;

function number(value: string | null) {
  return value ? <span className="whitespace-nowrap tabular-nums">{value}</span> : missing;
}

/** At a glance: people, who is detained, how far along, and what comes next. */
function Summary({ detail, timeZone }: { detail: CaseDetail; timeZone: string }) {
  const { summary } = detail;
  const stages = useCatalogItems("stages");
  const hearingTypes = useCatalogItems("hearing-types");
  const next = summary.nextHearing;
  const stage = summary.mostDelayedStage;
  const people =
    summary.defendantCount === 0
      ? "Sin imputados cargados"
      : summary.openDefendantCount === summary.defendantCount
        ? countDefendants(summary.defendantCount)
        : `${countDefendants(summary.defendantCount)}, ${summary.openDefendantCount} con el proceso abierto`;

  return (
    <Card edge={summary.detaineeCount > 0 ? "detained" : "none"}>
      <CardContent asChild>
        <TermList
          className="grid gap-x-8 gap-y-3 text-meta sm:grid-cols-2"
          terms={[
            { term: "Imputados", value: <span className="font-semibold">{people}</span> },
            {
              term: "Personas detenidas",
              value:
                summary.detaineeCount > 0 ? (
                  <DetaineeBadge count={summary.detaineeCount} />
                ) : (
                  "Ninguna"
                ),
            },
            {
              term: "Etapa más atrasada",
              value: stage
                ? (stages.get(stage)?.name ??
                  detail.defendants.find((defendant) => defendant.stageCode === stage)?.stageName ??
                  stage)
                : "Sin imputados",
            },
            {
              term: "Próxima audiencia",
              value: next ? (
                <span className="grid">
                  <time dateTime={next.startsAt} className="font-semibold tabular-nums">
                    {formatLongDateTime(next.startsAt, timeZone)}
                  </time>
                  {hearingTypes.get(next.typeCode) && (
                    <span>{hearingTypes.get(next.typeCode)?.name}</span>
                  )}
                </span>
              ) : (
                "Sin audiencias pendientes"
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function CaseData({ detail, timeZone }: { detail: CaseDetail; timeZone: string }) {
  const article = cppArticle(detail.actionArticle);
  return (
    <Card>
      <CardContent asChild>
        <TermList
          terms={[
            { term: "Legajo del MPF", value: number(detail.mpfLegajo) },
            { term: "Número de la OFIJU", value: number(detail.ofijuNumber) },
            { term: "Número en Pehuén", value: number(detail.pehuenNumber) },
            { term: "Número interno del estudio", value: number(detail.internalNumber) },
            { term: "Circunscripción", value: detail.circumscriptionName },
            {
              term: "Acción",
              value: (
                <>
                  {ACTION_TYPE_LABELS[detail.actionType]}
                  {article && (
                    <span className="text-muted-foreground tabular-nums"> ({article})</span>
                  )}
                </>
              ),
            },
            { term: "El estudio representa a", value: REPRESENTATION_LABELS[detail.represents] },
            {
              term: "Cargada el",
              value: (
                <time dateTime={detail.createdAt} className="tabular-nums">
                  {formatNumericDate(localDay(detail.createdAt, timeZone))}
                </time>
              ),
            },
          ]}
        />
      </CardContent>
      <p className="flex items-start gap-2 text-small text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
        <span>
          Los formatos del número de la OFIJU y del número en Pehuén todavía se están validando
          [validar].
        </span>
      </p>
    </Card>
  );
}

const ROLE_ORDER: TeamRole[] = ["RESPONSIBLE", "COLLABORATOR", "PARALEGAL"];

function Team({ detail }: { detail: CaseDetail }) {
  if (detail.team.length === 0) {
    return <p className="text-meta text-muted-foreground">Sin equipo asignado.</p>;
  }
  const team = [...detail.team].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
  return (
    <ul className="grid gap-2 text-meta">
      {team.map((member) => (
        <li key={member.userId} className="flex flex-wrap justify-between gap-x-3">
          <span className="font-semibold">{member.displayName}</span>
          <span className="text-muted-foreground">{TEAM_ROLE_LABELS[member.role]}</span>
        </li>
      ))}
    </ul>
  );
}

function Parties({ detail }: { detail: CaseDetail }) {
  if (detail.parties.length === 0) {
    return (
      <p className="text-meta text-muted-foreground">
        Todavía no hay otras partes cargadas (víctima, fiscal, querella, testigos).
      </p>
    );
  }
  return (
    <ul className="grid gap-2 text-meta">
      {detail.parties.map((party) => (
        <li key={party.id} className="flex flex-wrap justify-between gap-x-3">
          <span className="font-semibold">
            {party.displayName}
            {party.personArchived && (
              <span className="font-normal text-muted-foreground"> (ficha archivada)</span>
            )}
          </span>
          <span className="text-muted-foreground">{party.roleName}</span>
        </li>
      ))}
    </ul>
  );
}

/** Which form is open over the case. */
type CaseDialog =
  | { kind: "case" }
  | { kind: "defendant"; defendant?: DefendantView }
  | { kind: "hearing"; hearingId?: string }
  | null;

function CaseScreen({ detail }: { detail: CaseDetail }) {
  const now = useNow();
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;
  const { data: me } = useMe();
  const rights = caseRights(me, detail);
  const [dialog, setDialog] = useState<CaseDialog>(null);
  const close = () => setDialog(null);
  const editHearing = rights.edit
    ? (hearingId: string) => setDialog({ kind: "hearing", hearingId })
    : null;
  return (
    <HearingEditContext.Provider value={editHearing}>
      <div className="grid gap-2">
        <BackLink />
        <header className="grid gap-2">
          {(detail.reserved || detail.archived) && (
            <p className="flex flex-wrap gap-1.5">
              {detail.reserved && <ReservedBadge />}
              {detail.archived && <ArchivedBadge />}
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="grid min-w-0 gap-2">
              <h1 className="text-display font-bold text-balance">{detail.caption}</h1>
              <p className="flex flex-wrap gap-x-4 text-body text-muted-foreground">
                {detail.mpfLegajo && (
                  <span className="whitespace-nowrap tabular-nums">Legajo {detail.mpfLegajo}</span>
                )}
                <span>{detail.circumscriptionName}</span>
              </p>
            </div>
            {rights.edit && (
              <Button variant="outline" onClick={() => setDialog({ kind: "case" })}>
                <Pencil aria-hidden="true" />
                Editá la causa
              </Button>
            )}
          </div>
        </header>
      </div>

      {detail.archived && (
        <Alert variant="info">
          <Archive aria-hidden="true" />
          <AlertTitle>Esta causa está archivada</AlertTitle>
          <AlertDescription>
            La ves como quedó al archivarla: nada se borró. No aparece en la lista salvo que
            incluyas las archivadas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-7 xl:grid-cols-with-aside xl:gap-10">
        <div className="grid content-start gap-7">
          <Section title="Resumen">
            <Summary detail={detail} timeZone={timeZone} />
          </Section>
          <Section
            title="Imputados"
            action={
              rights.edit && (
                <Button variant="outline" onClick={() => setDialog({ kind: "defendant" })}>
                  <Plus aria-hidden="true" />
                  Agregá un imputado
                </Button>
              )
            }
          >
            {detail.defendants.length > 0 ? (
              <ul className="grid gap-3">
                {detail.defendants.map((defendant) => (
                  <li key={defendant.id}>
                    <DefendantCard
                      defendant={defendant}
                      today={todayIn(timeZone, now)}
                      onEdit={
                        rights.edit ? () => setDialog({ kind: "defendant", defendant }) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-muted-foreground">
                Esta causa todavía no tiene imputados cargados.
              </p>
            )}
          </Section>
          <Section title="Plazos">
            <CaseDeadlines caseId={detail.id} timeZone={timeZone} />
          </Section>
          <Section
            title="Audiencias"
            action={
              rights.edit && (
                <Button variant="outline" onClick={() => setDialog({ kind: "hearing" })}>
                  <Plus aria-hidden="true" />
                  Nueva audiencia
                </Button>
              )
            }
          >
            <CaseHearings caseId={detail.id} timeZone={timeZone} now={now} />
          </Section>
        </div>
        <div className="grid content-start gap-7">
          <Section title="Datos de la causa">
            <CaseData detail={detail} timeZone={timeZone} />
          </Section>
          <Section title="Partes">
            <Parties detail={detail} />
          </Section>
          <Section title="Equipo">
            <Team detail={detail} />
          </Section>
        </div>
      </div>

      {dialog?.kind === "case" && (
        <CaseFormDialog detail={detail} canChangeReserved={rights.changeReserved} onClose={close} />
      )}
      {dialog?.kind === "defendant" && (
        <DefendantFormDialog caseId={detail.id} defendant={dialog.defendant} onClose={close} />
      )}
      {dialog?.kind === "hearing" && (
        <HearingFormDialog
          caseId={dialog.hearingId ? undefined : detail.id}
          hearingId={dialog.hearingId}
          onClose={close}
        />
      )}
    </HearingEditContext.Provider>
  );
}

/**
 * `/causas/$caseId`, read only (ADR-0024): the case's header and numbers, the computed summary,
 * each defendant with their liberty situation, the deadlines (ADR-0025), the hearings, the
 * parties and the team.
 */
export function CaseDetailPage({ caseId }: { caseId: string }) {
  const query = useCase(caseId);
  const catalogsSettled = useCatalogsSettled(DETAIL_CATALOGS);

  if (query.isPending || (query.isSuccess && !catalogsSettled)) return <CaseDetailSkeleton />;
  if (query.isError) {
    const status = isApiError(query.error) ? query.error.status : 0;
    // 400: the backend rejects an id it cannot parse; for the user that case does not exist either.
    if (status === 404 || status === 400) return <CaseNotFound />;
    return (
      <>
        <div className="grid gap-2">
          <BackLink />
          <PageHeader title="Causa" />
        </div>
        <LoadError
          title="No pudimos cargar la causa"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }
  return <CaseScreen detail={query.data} />;
}
