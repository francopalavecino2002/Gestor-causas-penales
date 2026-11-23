import type { DeadlineView } from "@/features/deadlines/deadline-types";
import { apiFetch } from "@/lib/api";

/**
 * Overdue, due within `withinDays` (1 to 365) or not calculable, across the cases the user sees.
 * Detainee deadlines first, then the soonest.
 */
export function fetchUpcomingDeadlines(
  withinDays: number,
  signal?: AbortSignal,
): Promise<DeadlineView[]> {
  const params = new URLSearchParams({ withinDays: String(withinDays) });
  return apiFetch<DeadlineView[]>(`/api/v1/deadlines?${params.toString()}`, { signal });
}

/** Every deadline of the case that is not archived (met and suspended ones included). */
export function fetchCaseDeadlines(caseId: string, signal?: AbortSignal): Promise<DeadlineView[]> {
  return apiFetch<DeadlineView[]>(`/api/v1/cases/${encodeURIComponent(caseId)}/deadlines`, {
    signal,
  });
}
