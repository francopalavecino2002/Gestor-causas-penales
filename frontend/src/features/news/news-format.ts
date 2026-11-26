import {
  addDays,
  formatDayLabel,
  formatShortDayLabel,
  formatTime,
  localDay,
} from "@/features/agenda/agenda-dates";
import type { IsoDate } from "@/features/agenda/agenda-types";
import type { DeadlineAlert, NewsActor, NewsItem } from "@/features/news/news-types";

/** Shown when the API sends no disclaimer: the system assists, the lawyer controls (rule 6). */
export const FALLBACK_DISCLAIMER = "Cálculo asistido: verificá con la norma.";

/** A verb in the three voices of the wall: someone else, the user ("vos") and nobody (system). */
interface Verb {
  third: string;
  vos: string;
  impersonal: string;
}

const VERBS = {
  opened: { third: "abrió", vos: "Abriste", impersonal: "Se abrió" },
  openedMany: { third: "abrió", vos: "Abriste", impersonal: "Se abrieron" },
  scheduled: { third: "cargó", vos: "Cargaste", impersonal: "Se cargó" },
  rescheduled: { third: "reprogramó", vos: "Reprogramaste", impersonal: "Se reprogramó" },
  result: { third: "cargó", vos: "Cargaste", impersonal: "Se cargó" },
  posted: { third: "publicó", vos: "Publicaste", impersonal: "Se publicó" },
} satisfies Record<string, Verb>;

/** The member's name, or a neutral one when their record is gone. */
export function actorName(actor: NewsActor): string {
  return actor.displayName?.trim() || "Alguien del estudio";
}

/** "Paula Demo abrió", "Abriste" (the user), "Se abrió" (no member: seed data or an import job). */
function lead(verb: Verb, actor: NewsActor | null, meId: string | undefined): string {
  if (!actor) return verb.impersonal;
  if (actor.id === meId) return verb.vos;
  return `${actorName(actor)} ${verb.third}`;
}

/** Catalog names are written in sentence case: inside a sentence they start in lower case. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("es-AR") + text.slice(1);
}

/** "lunes 30/11 a las 10:00" in the firm's zone. */
function dayAndTime(instant: string, timeZone: string): string {
  return `${formatShortDayLabel(localDay(instant, timeZone))} a las ${formatTime(instant, timeZone)}`;
}

function rescheduleText(previous: string | null, next: string, timeZone: string): string {
  if (!previous) return `para el ${dayAndTime(next, timeZone)}`;
  const before = localDay(previous, timeZone);
  const after = localDay(next, timeZone);
  if (before === after) {
    return `del ${formatShortDayLabel(after)}: pasó de las ${formatTime(previous, timeZone)} a las ${formatTime(next, timeZone)}`;
  }
  return `del ${dayAndTime(previous, timeZone)} al ${dayAndTime(next, timeZone)}`;
}

/**
 * What happened, as one sentence in the firm's zone: "Paula Demo abrió una causa nueva.",
 * "Se reprogramó la audiencia de control de acusación del jueves 3/12 a las 10:00 al jueves 10/12
 * a las 11:00.", "Cargaste el resultado de la audiencia de ... del lunes 23/11: Efectiva." The
 * case goes on its own line, as a link.
 */
export function newsSentence(item: NewsItem, timeZone: string, meId?: string): string {
  const { actor, hearing } = item;
  const type = hearing ? lowerFirst(hearing.typeName) : "";
  switch (item.kind) {
    case "CASE_OPENED":
      return `${lead(VERBS.opened, actor, meId)} una causa nueva.`;
    case "HEARING_SCHEDULED":
      return hearing
        ? `${lead(VERBS.scheduled, actor, meId)} la audiencia de ${type} para el ${dayAndTime(hearing.startsAt, timeZone)}.`
        : `${lead(VERBS.scheduled, actor, meId)} una audiencia.`;
    case "HEARING_RESCHEDULED":
      return hearing
        ? `${lead(VERBS.rescheduled, actor, meId)} la audiencia de ${type} ${rescheduleText(
            hearing.previousStartsAt,
            hearing.newStartsAt ?? hearing.startsAt,
            timeZone,
          )}.`
        : `${lead(VERBS.rescheduled, actor, meId)} una audiencia.`;
    case "HEARING_RESULT": {
      if (!hearing) return `${lead(VERBS.result, actor, meId)} el resultado de una audiencia.`;
      const day = formatShortDayLabel(localDay(hearing.startsAt, timeZone));
      const result = hearing.statusName ? `: ${hearing.statusName}` : "";
      return `${lead(VERBS.result, actor, meId)} el resultado de la audiencia de ${type} del ${day}${result}.`;
    }
    case "POST":
      return `${lead(VERBS.posted, actor, meId)}:`;
  }
}

/** "Se abrieron 12 causas nuevas." for a bulk import collapsed into one entry. */
export function bulkOpenedSentence(actor: NewsActor | null, count: number, meId?: string): string {
  return `${lead(VERBS.openedMany, actor, meId)} ${count} causas nuevas.`;
}

/**
 * The items of several pages without repeats: with offset pages, an entry added between two
 * requests pushes the last one of a page onto the next. The first copy (newest page order) wins.
 */
export function uniqueById(items: NewsItem[]): NewsItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** One line of the wall: an item, or several cases opened at once (a bulk import). */
export type NewsEntry =
  { kind: "item"; item: NewsItem } | { kind: "bulk"; actor: NewsActor | null; items: NewsItem[] };

/** Cases opened by the same member within this span read as one import. */
const BULK_WINDOW_MS = 60_000;

/** Fewer than this many stay one per line: two cases are not noise. */
const BULK_MIN = 3;

function sameActor(a: NewsActor | null, b: NewsActor | null): boolean {
  return (a?.id ?? null) === (b?.id ?? null);
}

/**
 * The items as entries, in the same order: runs of at least three "case opened" by the same member
 * within a minute (an import) collapse into one entry that lists them.
 */
export function collapseBulk(items: NewsItem[]): NewsEntry[] {
  const entries: NewsEntry[] = [];
  let run: NewsItem[] = [];
  const flush = () => {
    const [first] = run;
    if (first && run.length >= BULK_MIN) {
      entries.push({ kind: "bulk", actor: first.actor, items: run });
    } else {
      for (const item of run) entries.push({ kind: "item", item });
    }
    run = [];
  };
  for (const item of items) {
    const first = run[0];
    const joins =
      first !== undefined &&
      item.kind === "CASE_OPENED" &&
      sameActor(first.actor, item.actor) &&
      Math.abs(Date.parse(first.occurredAt) - Date.parse(item.occurredAt)) <= BULK_WINDOW_MS;
    if (!joins) flush();
    if (item.kind === "CASE_OPENED") run.push(item);
    else entries.push({ kind: "item", item });
  }
  flush();
  return entries;
}

export interface NewsDay {
  day: IsoDate;
  entries: NewsEntry[];
}

/** The wall by local day, newest first as the API sends it, with bulk imports collapsed per day. */
export function groupNewsByDay(items: NewsItem[], timeZone: string): NewsDay[] {
  const days: { day: IsoDate; items: NewsItem[] }[] = [];
  for (const item of items) {
    const day = localDay(item.occurredAt, timeZone);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days.map(({ day, items: dayItems }) => ({ day, entries: collapseBulk(dayItems) }));
}

/** "Hoy", "Ayer", "Jueves 19 de noviembre" (with the year when it is not this year's). */
export function dayHeading(day: IsoDate, today: IsoDate): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  return formatDayLabel(day, { year: day.slice(0, 4) !== today.slice(0, 4) });
}

/**
 * When it happened: "Recién", "Hace 5 minutos" within the hour, else "10:20". With `withDay`
 * (lists without day headings) older entries add the day: "Ayer, 18:30", "jueves 19/11, 09:05".
 */
export function timeLabel(
  occurredAt: string,
  now: Date,
  timeZone: string,
  options: { withDay?: boolean } = {},
): string {
  const minutes = Math.floor((now.getTime() - Date.parse(occurredAt)) / 60_000);
  if (minutes >= 0 && minutes < 1) return "Recién";
  if (minutes >= 1 && minutes < 60) {
    return minutes === 1 ? "Hace 1 minuto" : `Hace ${minutes} minutos`;
  }
  const time = formatTime(occurredAt, timeZone);
  if (!options.withDay) return time;
  const day = localDay(occurredAt, timeZone);
  const today = localDay(now, timeZone);
  if (day === today) return time;
  if (day === addDays(today, -1)) return `Ayer, ${time}`;
  return `${formatShortDayLabel(day)}, ${time}`;
}

/** Below this many hours an hour-based deadline counts in hours; above, in days. */
const HOURS_UNTIL_DAYS = 48;

/**
 * Whether the term ends at an hour (24 h from a detention) rather than at 24 h of its last day.
 * A day-based term's `dueAt` is the start of the next day, so its local day is not `dueOn`.
 */
export function isHourBased(alert: DeadlineAlert, timeZone: string): boolean {
  return alert.dueAt !== null && localDay(alert.dueAt, timeZone) === alert.dueOn;
}

/**
 * How far a deadline is: "Quedan 15 horas" (hour-based, last two days), "Vence hoy", "Vence
 * mañana", "Quedan 6 días". Null when the backend sends no count.
 */
export function remainingText(alert: DeadlineAlert, timeZone: string): string | null {
  const { daysLeft, hoursLeft } = alert;
  if (isHourBased(alert, timeZone) && hoursLeft !== null && hoursLeft < HOURS_UNTIL_DAYS) {
    if (hoursLeft < 1) return "Queda menos de una hora";
    return hoursLeft === 1 ? "Queda 1 hora" : `Quedan ${hoursLeft} horas`;
  }
  if (daysLeft === null) return null;
  if (daysLeft <= 0) return "Vence hoy";
  if (daysLeft === 1) return "Vence mañana";
  return `Quedan ${daysLeft} días`;
}

/** "Vence el martes 24/11" or, hour-based, "Vence el martes 24/11 a las 02:00". */
export function dueText(alert: DeadlineAlert, timeZone: string): string {
  if (alert.dueAt && isHourBased(alert, timeZone)) {
    return `Vence el ${dayAndTime(alert.dueAt, timeZone)}`;
  }
  return `Vence el ${formatShortDayLabel(alert.dueOn)} (hasta las 24)`;
}

/** Deadlines of people deprived of liberty first; otherwise the backend's order (soonest first). */
export function detaineeFirst(alerts: DeadlineAlert[]): DeadlineAlert[] {
  return [
    ...alerts.filter((alert) => alert.detainee),
    ...alerts.filter((alert) => !alert.detainee),
  ];
}

/** "1 plazo vence pronto", "3 plazos vencen pronto". */
export function dueSoonCount(count: number): string {
  return count === 1 ? "1 plazo vence pronto" : `${count} plazos vencen pronto`;
}
