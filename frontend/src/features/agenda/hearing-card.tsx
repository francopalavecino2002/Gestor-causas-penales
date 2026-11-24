import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronDown,
  Clock,
  FileText,
  Gavel,
  Lock,
  MapPin,
  Pencil,
  User,
  type LucideIcon,
} from "lucide-react";

import { HearingStatusBadge } from "@/components/hearing/hearing-status-badge";
import { HEARING_STATUSES, type HearingStatus } from "@/components/hearing/hearing-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addMinutes, formatTime } from "@/features/agenda/agenda-dates";
import { cppArticle, joinNames } from "@/features/agenda/agenda-format";
import type { AgendaItem } from "@/features/agenda/agenda-types";
import { useHearingEdit } from "@/features/hearings/hearing-edit-context";
import { AreaBadge } from "@/features/practice-areas/area-badge";
import { cn } from "@/lib/utils";

function isKnownStatus(code: string): code is HearingStatus {
  return (HEARING_STATUSES as readonly string[]).includes(code);
}

/**
 * The OFIJU status; a status a firm added to its catalog shows its own name, in neutral. Takes
 * any hearing that carries its status code and name (agenda items, a case's hearings).
 */
export function AgendaStatusBadge({
  item,
  className,
}: {
  item: Pick<AgendaItem, "statusCode" | "statusName">;
  className?: string;
}) {
  return isKnownStatus(item.statusCode) ? (
    <HearingStatusBadge status={item.statusCode} className={className} />
  ) : (
    <Badge variant="neutral" className={className}>
      {item.statusName}
    </Badge>
  );
}

/** "Persona detenida" (red: liberty) and "Superposición de horario", each with its icon. */
function HearingMarkers({ item }: { item: AgendaItem }) {
  if (!item.detainee && !item.hasClash) return null;
  return (
    <>
      {item.detainee && (
        <Badge variant="detained" className="whitespace-normal">
          <Lock aria-hidden="true" />
          Persona detenida
        </Badge>
      )}
      {item.hasClash && (
        <Badge variant="outline" className="whitespace-normal">
          <CalendarClock aria-hidden="true" />
          Superposición de horario
        </Badge>
      )}
    </>
  );
}

/**
 * Defendants in bold with the markers next to them, and the case's area when the firm works in
 * more than one. Empty (nothing rendered) when there is nothing to say.
 */
function HearingPeople({ item }: { item: AgendaItem }) {
  const names = joinNames(item.defendants);
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 empty:hidden">
      {names && <span className="font-semibold">{names}</span>}
      <AreaBadge code={item.practiceArea} />
      <HearingMarkers item={item} />
    </p>
  );
}

/** The case caption, linked to the case. */
function CaseLink({ item }: { item: Pick<AgendaItem, "caseId" | "caseCaption"> }) {
  return (
    <Link
      to="/causas/$caseId"
      params={{ caseId: item.caseId }}
      className="text-primary underline underline-offset-4 hover:decoration-2"
    >
      {item.caseCaption}
    </Link>
  );
}

interface MetaRow {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
}

function metaRows(item: AgendaItem, timeZone: string): MetaRow[] {
  const end = addMinutes(item.startsAt, item.durationMinutes);
  const rows: MetaRow[] = [
    {
      icon: Clock,
      term: "Duración",
      value: (
        <>
          {item.durationMinutes} min, hasta las{" "}
          <time dateTime={end.toISOString()}>{formatTime(end, timeZone)}</time>
        </>
      ),
    },
  ];
  if (item.room) rows.push({ icon: MapPin, term: "Sala", value: item.room });
  if (item.judge) rows.push({ icon: Gavel, term: "Juez o jueza", value: item.judge });
  rows.push({ icon: FileText, term: "Causa", value: <CaseLink item={item} /> });
  if (item.lawyers.length > 0) {
    rows.push({ icon: User, term: "Abogados del estudio", value: joinNames(item.lawyers) });
  }
  return rows;
}

function HearingMeta({
  rows,
  id,
  className,
}: {
  rows: MetaRow[];
  id?: string;
  className?: string;
}) {
  return (
    <CardContent asChild>
      <dl id={id} className={cn("text-meta text-muted-foreground", className)}>
        {rows.map(({ icon: Icon, term, value }) => (
          <div key={term} className="flex min-w-0 items-start gap-2">
            <dt className="sr-only">{term}</dt>
            <Icon aria-hidden="true" className="mt-0.75 size-4.5 shrink-0" />
            <dd className="min-w-0 text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </CardContent>
  );
}

function HearingTitle({ item, id, as }: { item: AgendaItem; id: string; as: "h2" | "h3" }) {
  const article = cppArticle(item.typeArticle);
  return (
    <div className="grid min-w-0">
      <CardTitle as={as} id={id}>
        {item.typeName}
      </CardTitle>
      {article && <CardDescription className="tabular-nums">{article}</CardDescription>}
    </div>
  );
}

/**
 * A hearing on the day rail. A finished one starts collapsed (title, status, defendants) so the
 * upcoming ones move up; "Ver detalle" opens the rest. Nothing is hidden for good.
 */
export function HearingCard({
  item,
  timeZone,
  finished = false,
}: {
  item: AgendaItem;
  timeZone: string;
  finished?: boolean;
}) {
  const titleId = useId();
  const detailId = useId();
  const [open, setOpen] = useState(!finished);
  const edit = useHearingEdit();
  return (
    <Card edge={item.detainee ? "detained" : "none"} asChild>
      <article aria-labelledby={titleId} data-hearing-id={item.hearingId}>
        <CardHeader>
          <HearingTitle item={item} id={titleId} as="h2" />
          <AgendaStatusBadge item={item} />
        </CardHeader>
        <HearingPeople item={item} />
        {open && (
          <HearingMeta
            id={detailId}
            rows={metaRows(item, timeZone)}
            className="md:grid-cols-2 md:gap-x-6"
          />
        )}
        {(finished || edit) && (
          <div className="-mx-2 -mb-2 flex flex-wrap items-center gap-x-2">
            {finished && (
              <Button
                variant="ghost"
                className="px-2 text-primary"
                aria-expanded={open}
                aria-controls={open ? detailId : undefined}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "Ocultá el detalle" : "Mirá el detalle"}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-fast ease-out",
                    open && "rotate-180",
                  )}
                />
              </Button>
            )}
            {edit && (
              <Button
                variant="ghost"
                className="px-2 text-primary"
                aria-label={`Editá la audiencia ${item.typeName}`}
                onClick={() => edit(item.hearingId)}
              >
                <Pencil aria-hidden="true" />
                Editá
              </Button>
            )}
          </div>
        )}
      </article>
    </Card>
  );
}

/**
 * A hearing in the week list: a compact card on phones, a table-like row from 768 px (time,
 * hearing, room and judge, status), following direction B's docket kept for the week view.
 */
export function HearingRow({ item, timeZone }: { item: AgendaItem; timeZone: string }) {
  const titleId = useId();
  const end = addMinutes(item.startsAt, item.durationMinutes);
  const place: MetaRow[] = [];
  if (item.room) place.push({ icon: MapPin, term: "Sala", value: item.room });
  if (item.judge) place.push({ icon: Gavel, term: "Juez o jueza", value: item.judge });
  return (
    <Card
      edge={item.detainee ? "detained" : "none"}
      asChild
      className="grid-cols-[1fr_auto] gap-x-4 gap-y-2 py-3 md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,15rem)_auto] md:gap-x-6"
    >
      <article aria-labelledby={titleId} data-hearing-id={item.hearingId}>
        <p className="col-start-1 row-start-1 grid content-start">
          <time dateTime={item.startsAt} className="text-time font-bold">
            {formatTime(item.startsAt, timeZone)}
          </time>
          <span className="text-small text-muted-foreground">
            <span className="sr-only">hasta las </span>
            <span aria-hidden="true">a </span>
            <time dateTime={end.toISOString()}>{formatTime(end, timeZone)}</time>
          </span>
        </p>
        <AgendaStatusBadge
          item={item}
          className="col-start-2 row-start-1 self-start justify-self-end md:col-start-4"
        />
        <div className="col-span-2 grid min-w-0 gap-1.5 md:col-span-1 md:col-start-2 md:row-start-1">
          <HearingTitle item={item} id={titleId} as="h3" />
          <HearingPeople item={item} />
          <p className="text-meta text-muted-foreground">
            <span className="sr-only">Causa: </span>
            <CaseLink item={item} />
          </p>
        </div>
        {place.length > 0 && (
          <HearingMeta
            rows={place}
            className="col-span-2 content-start md:col-span-1 md:col-start-3 md:row-start-1 md:pt-0.5"
          />
        )}
      </article>
    </Card>
  );
}
