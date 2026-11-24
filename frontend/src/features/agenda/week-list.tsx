import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { daysBetween, formatDayLabel, groupByDay } from "@/features/agenda/agenda-dates";
import { countHearings } from "@/features/agenda/agenda-format";
import type { AgendaSearch } from "@/features/agenda/agenda-search";
import type { AgendaItem, IsoDate } from "@/features/agenda/agenda-types";
import { HearingRow } from "@/features/agenda/hearing-card";

function DaySection({
  day,
  items,
  timeZone,
  today,
  lawyerId,
  areaCode,
}: {
  day: IsoDate;
  items: AgendaItem[];
  timeZone: string;
  today: IsoDate;
  lawyerId: string | undefined;
  areaCode: string | undefined;
}) {
  const headingId = useId();
  const isToday = day === today;
  const search: AgendaSearch = {
    fecha: isToday ? undefined : day,
    abogado: lawyerId,
    fuero: areaCode,
  };
  return (
    <section aria-labelledby={headingId} className="grid gap-2.5" data-day={day}>
      {/* Sticky under the top bar on phones and tablets, so the day stays in sight while scrolling. */}
      <header className="sticky top-below-top-bar z-10 -mx-4 flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-b bg-background px-4 py-1.5 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-b-0 lg:px-0 lg:py-0">
        <h2 id={headingId} className="text-title font-bold">
          <Link
            to="/"
            search={search}
            className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline"
          >
            {formatDayLabel(day)}
            <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            <span className="sr-only">. Ver el día</span>
          </Link>
        </h2>
        <p className="flex items-center gap-2 text-meta text-muted-foreground">
          {isToday && <Badge variant="neutral">Hoy</Badge>}
          {items.length > 0 ? countHearings(items.length) : "Sin audiencias"}
        </p>
      </header>
      {items.length > 0 && (
        <ol className="grid gap-2.5">
          {items.map((item) => (
            <li key={item.hearingId}>
              <HearingRow item={item} timeZone={timeZone} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Seven days, Monday first, each with its hearings in order; empty days say so. */
export function WeekList({
  from,
  to,
  items,
  timeZone,
  today,
  lawyerId,
  areaCode,
}: {
  from: IsoDate;
  to: IsoDate;
  items: AgendaItem[];
  timeZone: string;
  today: IsoDate;
  lawyerId: string | undefined;
  /** The area filter, kept when a day is opened. */
  areaCode?: string;
}) {
  return (
    <div className="grid gap-7">
      {groupByDay(items, daysBetween(from, to), timeZone).map((group) => (
        <DaySection
          key={group.day}
          day={group.day}
          items={group.items}
          timeZone={timeZone}
          today={today}
          lawyerId={lawyerId}
          areaCode={areaCode}
        />
      ))}
    </div>
  );
}
