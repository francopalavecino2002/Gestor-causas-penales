import { useId } from "react";
import { Gavel, MapPin, NotebookText, Pencil, User, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cppArticle, joinNames } from "@/features/agenda/agenda-format";
import { AgendaStatusBadge } from "@/features/agenda/hearing-card";
import { formatLongDateTime, groupCaseHearings } from "@/features/cases/case-format";
import { useCaseHearings } from "@/features/cases/case-queries";
import { LoadError } from "@/features/cases/case-states";
import type { CaseHearing } from "@/features/cases/case-types";
import { useHearingEdit } from "@/features/hearings/hearing-edit-context";

function HearingItem({ hearing, timeZone }: { hearing: CaseHearing; timeZone: string }) {
  const titleId = useId();
  const edit = useHearingEdit();
  const article = cppArticle(hearing.typeArticle);
  const meta: { icon: LucideIcon; term: string; value: string }[] = [];
  if (hearing.room) meta.push({ icon: MapPin, term: "Sala", value: hearing.room });
  if (hearing.judge) meta.push({ icon: Gavel, term: "Juez o jueza", value: hearing.judge });
  if (hearing.defendants.length > 0) {
    meta.push({ icon: User, term: "Imputados citados", value: joinNames(hearing.defendants) });
  }
  if (hearing.cancellationReasonName) {
    meta.push({ icon: NotebookText, term: "Motivo", value: hearing.cancellationReasonName });
  }
  if (hearing.resultSummary) {
    meta.push({ icon: NotebookText, term: "Resultado", value: hearing.resultSummary });
  }
  return (
    <Card asChild>
      <article aria-labelledby={titleId}>
        <CardHeader>
          <div className="grid min-w-0">
            <p className="text-meta font-semibold">
              <time dateTime={hearing.startsAt} className="tabular-nums">
                {formatLongDateTime(hearing.startsAt, timeZone)}
              </time>
            </p>
            <CardTitle as="h4" id={titleId}>
              {hearing.typeName}
            </CardTitle>
            {article && <CardDescription className="tabular-nums">{article}</CardDescription>}
            {hearing.heldAsTypeName && hearing.heldAsTypeCode !== hearing.typeCode && (
              <CardDescription>Se hizo como {hearing.heldAsTypeName}</CardDescription>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <AgendaStatusBadge item={hearing} />
            {edit && (
              <Button
                variant="ghost"
                className="-mr-2 px-2 text-primary"
                aria-label={`Editá la audiencia ${hearing.typeName}`}
                onClick={() => edit(hearing.id)}
              >
                <Pencil aria-hidden="true" />
                Editá
              </Button>
            )}
          </div>
        </CardHeader>
        {meta.length > 0 && (
          <CardContent asChild>
            <dl className="text-meta">
              {meta.map(({ icon: Icon, term, value }) => (
                <div key={term} className="flex min-w-0 items-start gap-2">
                  <dt className="sr-only">{term}</dt>
                  <Icon
                    aria-hidden="true"
                    className="mt-0.75 size-4.5 shrink-0 text-muted-foreground"
                  />
                  <dd className="min-w-0">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        )}
      </article>
    </Card>
  );
}

function HearingGroup({
  title,
  hearings,
  timeZone,
}: {
  title: string;
  hearings: CaseHearing[];
  timeZone: string;
}) {
  const headingId = useId();
  if (hearings.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="grid gap-2.5">
      <h3 id={headingId} className="text-card-title font-bold">
        {title}
      </h3>
      <ol className="grid gap-2.5">
        {hearings.map((hearing) => (
          <li key={hearing.id}>
            <HearingItem hearing={hearing} timeZone={timeZone} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The case's hearings: the upcoming ones first, the soonest on top, then future ones that were
 * suspended or cancelled, then the past ones, the most recent on top.
 */
export function CaseHearings({
  caseId,
  timeZone,
  now,
  scheduledBy = "la Oficina Judicial",
}: {
  caseId: string;
  /** Who sets the hearing dates in the case's area, for the empty state. */
  scheduledBy?: string;
  timeZone: string;
  now: Date;
}) {
  const hearings = useCaseHearings(caseId);

  if (hearings.isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Cargando las audiencias"
        className="grid gap-2.5"
      >
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }
  if (hearings.isError) {
    return (
      <LoadError
        title="No pudimos cargar las audiencias de la causa"
        error={hearings.error}
        onRetry={() => void hearings.refetch()}
      />
    );
  }
  if (hearings.data.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        Esta causa todavía no tiene audiencias. Cuando {scheduledBy} fije una fecha, cargala y la
        vas a ver acá y en la agenda.
      </p>
    );
  }

  const { upcoming, called, past } = groupCaseHearings(hearings.data, now);

  return (
    <div className="grid gap-5">
      <HearingGroup title="Próximas" hearings={upcoming} timeZone={timeZone} />
      <HearingGroup title="Suspendidas o canceladas" hearings={called} timeZone={timeZone} />
      <HearingGroup title="Anteriores" hearings={past} timeZone={timeZone} />
    </div>
  );
}
