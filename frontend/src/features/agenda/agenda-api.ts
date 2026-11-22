import type { AgendaView, DetaineeAlert, IsoDate } from "@/features/agenda/agenda-types";
import { apiFetch } from "@/lib/api";

export interface AgendaRange {
  from: IsoDate;
  /** Inclusive; the backend accepts at most 31 days. */
  to: IsoDate;
  /** Only the hearings this lawyer (user id) attends. */
  lawyerId?: string;
}

export function fetchAgenda(range: AgendaRange, signal?: AbortSignal): Promise<AgendaView> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (range.lawyerId) params.set("lawyerId", range.lawyerId);
  return apiFetch<AgendaView>(`/api/v1/agenda?${params.toString()}`, { signal });
}

/** Alerts due within the backend's default window or already overdue, the most urgent first. */
export function fetchDetaineeAlerts(signal?: AbortSignal): Promise<DetaineeAlert[]> {
  return apiFetch<DetaineeAlert[]>("/api/v1/detainee-alerts", { signal });
}
