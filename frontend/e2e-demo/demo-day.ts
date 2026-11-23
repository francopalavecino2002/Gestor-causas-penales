import { FIRM_TIME_ZONE } from "./demo-users";

/** Today in the firm's zone, as YYYY-MM-DD. */
export function todayInFirm(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FIRM_TIME_ZONE }).format(new Date());
}

/**
 * The day the seed calls "today": on a weekend it is the next Monday (DemoCalendar), so the day
 * view of a Saturday is empty on purpose. Undefined when it is today.
 */
export function demoDay(): string | undefined {
  const today = todayInFirm();
  const date = new Date(`${today}T12:00:00Z`);
  const weekday = date.getUTCDay();
  if (weekday !== 0 && weekday !== 6) return undefined;
  date.setUTCDate(date.getUTCDate() + (weekday === 6 ? 2 : 1));
  return date.toISOString().slice(0, 10);
}
