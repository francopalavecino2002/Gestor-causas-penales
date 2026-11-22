import type { ReactNode } from "react";

import { addMinutes, formatTime, sortByStart } from "@/features/agenda/agenda-dates";
import type { AgendaItem } from "@/features/agenda/agenda-types";
import { HearingCard } from "@/features/agenda/hearing-card";
import { cn } from "@/lib/utils";

/*
 * Geometry of the rail (DESIGN.md, direction A): a time column, a 2 px line and a 12 px dot
 * centered on it. The column is 52 px (60 px from 768 px) and the gap 28 px, so the line sits
 * at 65 px (73 px) and the dot at 60 px (68 px).
 */
const SLOT = "relative grid grid-cols-[3.25rem_1fr] gap-x-7 md:grid-cols-[3.75rem_1fr]";

function RailSlot({
  item,
  timeZone,
  started,
  children,
}: {
  item: AgendaItem;
  timeZone: string;
  started: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        SLOT,
        "before:absolute before:top-4.75 before:left-15 before:size-3 before:rounded-full before:border-2 before:border-border-strong before:content-[''] md:before:left-17",
        started ? "before:bg-border-strong" : "before:bg-card",
      )}
    >
      <time dateTime={item.startsAt} className="pt-3.5 text-right text-time font-bold">
        {formatTime(item.startsAt, timeZone)}
      </time>
      {children}
    </li>
  );
}

function NowLine({ now, timeZone }: { now: Date; timeZone: string }) {
  const time = formatTime(now, timeZone);
  return (
    <li
      aria-label={`Ahora son las ${time}`}
      data-testid="now-line"
      className={cn(
        SLOT,
        "items-center text-small font-bold text-primary after:absolute after:top-1/2 after:left-14.75 after:size-3.5 after:-translate-y-1/2 after:rounded-full after:bg-primary after:content-[''] md:after:left-16.75",
      )}
    >
      <time dateTime={now.toISOString()} className="text-right">
        {time}
      </time>
      <span className="flex items-center gap-2.5">
        Ahora
        <span aria-hidden="true" className="h-0.5 flex-1 bg-primary" />
      </span>
    </li>
  );
}

/**
 * The hearings of one day in order, on a vertical rail. On today's rail the "Ahora" line sits
 * after the hearings that already started, and the ones that already ended start collapsed.
 */
export function DayRail({
  items,
  timeZone,
  now,
  isToday,
}: {
  items: AgendaItem[];
  timeZone: string;
  now: Date;
  isToday: boolean;
}) {
  const sorted = sortByStart(items);
  const nowMs = now.getTime();
  const started = (item: AgendaItem) => isToday && Date.parse(item.startsAt) <= nowMs;
  const finished = (item: AgendaItem) =>
    isToday && addMinutes(item.startsAt, item.durationMinutes).getTime() <= nowMs;
  const nowIndex = isToday ? sorted.filter(started).length : -1;

  const slots: ReactNode[] = sorted.map((item) => (
    <RailSlot key={item.hearingId} item={item} timeZone={timeZone} started={started(item)}>
      <HearingCard item={item} timeZone={timeZone} finished={finished(item)} />
    </RailSlot>
  ));
  if (nowIndex >= 0) {
    slots.splice(nowIndex, 0, <NowLine key="now" now={now} timeZone={timeZone} />);
  }

  return (
    <ol
      aria-label="Audiencias del día, en orden"
      className="relative grid gap-3.5 before:absolute before:top-1.5 before:bottom-1.5 before:left-16.25 before:w-0.5 before:bg-border before:content-[''] md:before:left-18.25"
    >
      {slots}
    </ol>
  );
}
