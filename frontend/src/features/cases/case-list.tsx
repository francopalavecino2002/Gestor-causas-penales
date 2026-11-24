import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, FileText, MapPin, Milestone, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogItem } from "@/features/catalogs/catalog-types";
import { ArchivedBadge, DetaineeBadge, ReservedBadge } from "@/features/cases/case-badges";
import { countDefendants, formatShortDateTime } from "@/features/cases/case-format";
import type { CaseView } from "@/features/cases/case-types";
import { AreaBadge } from "@/features/practice-areas/area-badge";
import { hasModule } from "@/features/practice-areas/practice-area-format";
import { cn } from "@/lib/utils";

/**
 * Catalog names the list needs, by practice area and then by code (a list may mix areas); codes
 * show while a catalog loads or if it fails.
 */
export interface CaseListCatalogs {
  stages: Map<string, Map<string, CatalogItem>>;
  hearingTypes: Map<string, Map<string, CatalogItem>>;
}

interface RowProps {
  item: CaseView;
  catalogs: CaseListCatalogs;
  timeZone: string;
}

/** The most delayed defendant's stage in a criminal case; the case's own stage elsewhere. */
function stageName(item: CaseView, catalogs: CaseListCatalogs): string {
  const code = item.summary.mostDelayedStage;
  if (!code) return withDefendants(item) ? "Sin imputados" : "Sin etapa";
  return catalogs.stages.get(item.practiceArea)?.get(code)?.name ?? item.stageName ?? code;
}

function withDefendants(item: CaseView): boolean {
  return hasModule(item.modules, "defendants");
}

/** The number a lawyer looks a case up by: the MPF legajo in criminal cases, else the firm's own. */
function caseNumber(item: CaseView): string | null {
  return hasModule(item.modules, "mpf-legajo") ? item.mpfLegajo : item.internalNumber;
}

function NextHearingText({ item, catalogs, timeZone }: RowProps) {
  const next = item.summary.nextHearing;
  if (!next) return <span className="text-muted-foreground">Sin audiencias pendientes</span>;
  const type = catalogs.hearingTypes.get(item.practiceArea)?.get(next.typeCode)?.name;
  return (
    <span className="grid">
      <time dateTime={next.startsAt} className="whitespace-nowrap tabular-nums">
        {formatShortDateTime(next.startsAt, timeZone)}
      </time>
      {type && <span className="text-muted-foreground">{type}</span>}
    </span>
  );
}

/** Under the table's "Legajo MPF" header a missing one is just "Sin cargar", on one line. */
function Legajo({ item, inTable = false }: { item: CaseView; inTable?: boolean }) {
  const value = caseNumber(item);
  const missing = hasModule(item.modules, "mpf-legajo") ? "Sin legajo MPF" : "Sin número interno";
  return value ? (
    <span className="whitespace-nowrap tabular-nums">{value}</span>
  ) : (
    <span className="whitespace-nowrap text-muted-foreground">
      {inTable ? "Sin cargar" : missing}
    </span>
  );
}

/** The area (only when the firm works in more than one), reserved and archived. */
function CaseFlags({ item, multipleAreas }: { item: CaseView; multipleAreas: boolean }) {
  if (!item.reserved && !item.archived && !multipleAreas) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      <AreaBadge code={item.practiceArea} />
      {item.reserved && <ReservedBadge />}
      {item.archived && <ArchivedBadge />}
    </span>
  );
}

/** The caption as the link to the case; on cards it covers the whole card (stretched link). */
function CaseLink({ item, stretched = false }: { item: CaseView; stretched?: boolean }) {
  return (
    <Link
      to="/causas/$caseId"
      params={{ caseId: item.id }}
      className={cn(
        "underline-offset-4 hover:underline",
        stretched && "after:absolute after:inset-0 after:rounded-xl after:content-['']",
      )}
    >
      {item.caption}
    </Link>
  );
}

/** A case on phones and tablets: caption, legajo and place, then people, stage and next hearing. */
function CaseCard({
  item,
  catalogs,
  timeZone,
  multipleAreas,
}: RowProps & { multipleAreas: boolean }) {
  const titleId = useId();
  const { summary } = item;
  const criminal = withDefendants(item);
  const rows = [
    {
      icon: FileText,
      term: hasModule(item.modules, "mpf-legajo") ? "Legajo MPF" : "Número interno",
      value: <Legajo item={item} />,
    },
    { icon: MapPin, term: "Circunscripción", value: item.circumscriptionName },
    {
      icon: Milestone,
      term: criminal ? "Etapa más atrasada" : "Etapa",
      value: stageName(item, catalogs),
    },
    {
      icon: CalendarClock,
      term: "Próxima audiencia",
      value: <NextHearingText item={item} catalogs={catalogs} timeZone={timeZone} />,
    },
  ];
  return (
    <Card
      edge={summary.detaineeCount > 0 ? "detained" : "none"}
      asChild
      className="relative transition-colors duration-fast ease-out hover:bg-accent"
    >
      <article aria-labelledby={titleId}>
        <CardHeader>
          <CardTitle as="h2" id={titleId} className="min-w-0">
            <CaseLink item={item} stretched />
          </CardTitle>
          <CaseFlags item={item} multipleAreas={multipleAreas} />
        </CardHeader>
        {criminal && (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {summary.detaineeCount > 0 && <DetaineeBadge count={summary.detaineeCount} />}
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Users aria-hidden="true" className="size-4.5 text-muted-foreground" />
              {countDefendants(summary.defendantCount)}
            </span>
          </p>
        )}
        <CardContent asChild>
          <dl className="text-meta">
            {rows.map(({ icon: Icon, term, value }) => (
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
      </article>
    </Card>
  );
}

export function CaseCards({
  items,
  catalogs,
  timeZone,
  multipleAreas = false,
}: Omit<RowProps, "item"> & { items: CaseView[]; multipleAreas?: boolean }) {
  return (
    <ul aria-label="Causas" className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="grid">
          <CaseCard
            item={item}
            catalogs={catalogs}
            timeZone={timeZone}
            multipleAreas={multipleAreas}
          />
        </li>
      ))}
    </ul>
  );
}

const headerCell = "px-4 py-3 text-left text-meta font-semibold text-muted-foreground";
const cell = "border-t px-4 py-3 align-top text-meta";

/** From 1024 px: a dense docket table with the same data, one case per row. */
export function CaseTable({
  items,
  catalogs,
  timeZone,
  caption,
  multipleAreas = false,
}: Omit<RowProps, "item"> & { items: CaseView[]; caption: string; multipleAreas?: boolean }) {
  // A list that mixes areas names the columns by what every row has.
  const allCriminal = items.every(withDefendants);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(headerCell, "pl-5")}>
              Causa
            </th>
            <th scope="col" className={cn(headerCell, "whitespace-nowrap")}>
              {allCriminal ? "Legajo MPF" : "Legajo o número"}
            </th>
            <th scope="col" className={headerCell}>
              Circunscripción
            </th>
            <th scope="col" className={headerCell}>
              Imputados
            </th>
            <th scope="col" className={headerCell}>
              {allCriminal ? "Etapa más atrasada" : "Etapa"}
            </th>
            <th scope="col" className={headerCell}>
              Próxima audiencia
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const detained = item.summary.detaineeCount > 0;
            return (
              <tr
                key={item.id}
                className="transition-colors duration-fast ease-out hover:bg-accent"
              >
                <th
                  scope="row"
                  className={cn(
                    cell,
                    "border-l-6 pl-4 text-left font-normal",
                    detained ? "border-l-detained-edge" : "border-l-transparent",
                  )}
                >
                  <span className="grid justify-items-start gap-1.5">
                    <span className="text-body font-bold">
                      <CaseLink item={item} />
                    </span>
                    <CaseFlags item={item} multipleAreas={multipleAreas} />
                  </span>
                </th>
                <td className={cell}>
                  <Legajo item={item} inTable />
                </td>
                <td className={cell}>{item.circumscriptionName}</td>
                <td className={cell}>
                  {!withDefendants(item) ? (
                    <span className="text-muted-foreground">No corresponde al fuero</span>
                  ) : (
                    <span className="grid justify-items-start gap-1.5">
                      <span className="whitespace-nowrap">
                        {countDefendants(item.summary.defendantCount)}
                      </span>
                      {detained && (
                        <DetaineeBadge
                          count={item.summary.detaineeCount}
                          className="whitespace-nowrap"
                        />
                      )}
                    </span>
                  )}
                </td>
                <td className={cell}>{stageName(item, catalogs)}</td>
                <td className={cell}>
                  <NextHearingText item={item} catalogs={catalogs} timeZone={timeZone} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
