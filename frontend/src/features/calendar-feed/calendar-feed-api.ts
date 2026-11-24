// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import { apiFetch, apiFetchBlob } from "../../lib/api";

/** Whether the member has a live calendar link, and since when (ADR-0034). */
export interface CalendarFeedStatus {
  active: boolean;
  /** ISO instant; null without a live link. */
  createdAt: string | null;
}

/**
 * A new link. `path` carries the secret and is answered only once: it cannot be read again, so
 * the screen keeps it in memory until the member leaves.
 */
export interface NewCalendarFeed {
  /** Relative, e.g. `/api/v1/calendar-feed/<secret>.ics`. */
  path: string;
  createdAt: string;
}

export function fetchCalendarFeed(signal?: AbortSignal): Promise<CalendarFeedStatus> {
  return apiFetch<CalendarFeedStatus>("/api/v1/me/calendar-feed", { signal });
}

/** Creates the member's link; an existing one stops working. */
export function createCalendarFeed(): Promise<NewCalendarFeed> {
  return apiFetch<NewCalendarFeed>("/api/v1/me/calendar-feed", { method: "POST" });
}

export function revokeCalendarFeed(): Promise<void> {
  return apiFetch("/api/v1/me/calendar-feed/revoke", { method: "POST" });
}

/** One hearing as an iCalendar file, for "Agregá al calendario". */
export function fetchHearingIcs(hearingId: string): Promise<Blob> {
  return apiFetchBlob(`/api/v1/hearings/${encodeURIComponent(hearingId)}/calendar.ics`, {
    accept: "text/calendar",
  });
}

/** The full address a calendar app subscribes to. */
export function feedUrl(path: string, origin: string = window.location.origin): string {
  return new URL(path, origin).toString();
}

/** The same address with the `webcal:` scheme, which phones open in their calendar app. */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:/, "webcal:");
}
