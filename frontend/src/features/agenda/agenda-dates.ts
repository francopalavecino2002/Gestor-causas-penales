// Relative import: the e2e project (tsconfig.node.json) uses this module through the fixtures
// and has no "@/" alias.
import type { IsoDate } from "./agenda-types";

/**
 * The firm's time zone until the API says otherwise (backend `HearingCalendar.ZONE`). Hearings
 * happen in Neuquén time whatever the device says, so "today" is computed in this zone. The
 * one place this value is written in the frontend.
 */
export const FIRM_TIME_ZONE = "America/Argentina/Salta";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day written as `YYYY-MM-DD` (rejects "2026-02-30"). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  return toUtc(value).toISOString().slice(0, 10) === value;
}

/** Midnight UTC of the day: date-only arithmetic without the device's zone getting in the way. */
function toUtc(day: IsoDate): Date {
  const [, year, month, date] = ISO_DATE.exec(day) ?? [];
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: IsoDate, amount: number): IsoDate {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return fromUtc(date);
}

/** Monday to Sunday of the week that contains the day (Argentine weeks start on Monday). */
export function weekRange(day: IsoDate): { from: IsoDate; to: IsoDate } {
  const sinceMonday = (toUtc(day).getUTCDay() + 6) % 7;
  const from = addDays(day, -sinceMonday);
  return { from, to: addDays(from, 6) };
}

/** Every day from `from` to `to`, both included. */
export function daysBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Intl formatters are expensive to build; keep one per locale, zone and options. */
function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, cached);
  }
  return cached;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** The local day an instant falls on in the given zone. */
export function localDay(instant: string | Date, timeZone: string): IsoDate {
  const parts = formatter("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  return localDay(now, timeZone);
}

/** "09:30": 24-hour clock in the given zone, as hearings are written in Argentina. */
export function formatTime(instant: string | Date, timeZone: string): string {
  const parts = formatter("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  return `${part(parts, "hour")}:${part(parts, "minute")}`;
}

/** `HH:MM`, 24-hour clock: what an `<input type="time">` gives. */
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isLocalTime(value: unknown): value is string {
  return typeof value === "string" && LOCAL_TIME.test(value);
}

/** How far the zone's wall clock is from UTC at that instant, in milliseconds. */
function zoneOffset(instant: Date, timeZone: string): number {
  const parts = formatter("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const wall = Date.UTC(
    Number(part(parts, "year")),
    Number(part(parts, "month")) - 1,
    Number(part(parts, "day")),
    Number(part(parts, "hour")),
    Number(part(parts, "minute")),
    Number(part(parts, "second")),
  );
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The ISO instant of a day and `HH:MM` on the wall clock of the given zone: a hearing at 09:30 in
 * Neuquén is 12:30 UTC whatever zone the device is in. Corrected twice, so it also holds across
 * a daylight-saving change in zones that have one.
 */
export function instantAt(day: IsoDate, time: string, timeZone: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const wall = toUtc(day).getTime() + ((hours ?? 0) * 60 + (minutes ?? 0)) * 60_000;
  let instant = wall - zoneOffset(new Date(wall), timeZone);
  instant = wall - zoneOffset(new Date(instant), timeZone);
  return new Date(instant).toISOString();
}

export function addMinutes(instant: string | Date, minutes: number): Date {
  return new Date(new Date(instant).getTime() + minutes * 60_000);
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-AR") + text.slice(1);
}

function dayParts(day: IsoDate) {
  const parts = formatter("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(toUtc(day));
  return {
    weekday: part(parts, "weekday"),
    day: part(parts, "day"),
    month: part(parts, "month"),
    year: part(parts, "year"),
  };
}

/** "Lunes 23 de noviembre" (with `year`: "Lunes 23 de noviembre de 2026"). */
export function formatDayLabel(day: IsoDate, options: { year?: boolean } = {}): string {
  const { weekday, day: date, month, year } = dayParts(day);
  return capitalize(`${weekday} ${date} de ${month}${options.year ? ` de ${year}` : ""}`);
}

/** "miércoles 25/11": short enough for an alert line on a phone. */
export function formatShortDayLabel(day: IsoDate): string {
  const { weekday } = dayParts(day);
  const [, month, date] = day.split("-").map(Number);
  return `${weekday} ${date}/${month}`;
}

/** "Del 23 al 29 de noviembre", "Del 30 de noviembre al 6 de diciembre", years when they differ. */
export function formatWeekLabel(from: IsoDate, to: IsoDate): string {
  const start = dayParts(from);
  const end = dayParts(to);
  const endText = `${end.day} de ${end.month}`;
  if (start.year !== end.year) {
    return `Del ${start.day} de ${start.month} de ${start.year} al ${endText} de ${end.year}`;
  }
  if (start.month !== end.month) return `Del ${start.day} de ${start.month} al ${endText}`;
  return `Del ${start.day} al ${endText}`;
}

export interface DayGroup<T> {
  day: IsoDate;
  items: T[];
}

/**
 * One group per day of the range (empty days included, so a week always shows seven days),
 * each with its items in start order. Items are placed by their local day in `timeZone`.
 */
export function groupByDay<T extends { startsAt: string }>(
  items: T[],
  days: IsoDate[],
  timeZone: string,
): DayGroup<T>[] {
  const byDay = new Map<IsoDate, T[]>(days.map((day) => [day, []]));
  for (const item of sortByStart(items)) {
    byDay.get(localDay(item.startsAt, timeZone))?.push(item);
  }
  return days.map((day) => ({ day, items: byDay.get(day) ?? [] }));
}

export function sortByStart<T extends { startsAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
