import { useCallback, useMemo, useSyncExternalStore } from "react";
import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { fetchAgenda, fetchDetaineeAlerts, type AgendaRange } from "@/features/agenda/agenda-api";
import type { AgendaView, NamedRef } from "@/features/agenda/agenda-types";

const AGENDA_KEY = "agenda";

export function agendaQueryOptions(range: AgendaRange) {
  return queryOptions({
    queryKey: [AGENDA_KEY, range.from, range.to, range.lawyerId ?? null] as const,
    queryFn: ({ signal }) => fetchAgenda(range, signal),
  });
}

export const detaineeAlertsQueryOptions = queryOptions({
  queryKey: ["detainee-alerts"] as const,
  queryFn: ({ signal }) => fetchDetaineeAlerts(signal),
});

export function useAgenda(range: AgendaRange) {
  return useQuery(agendaQueryOptions(range));
}

export function useDetaineeAlerts() {
  return useQuery(detaineeAlertsQueryOptions);
}

export interface AgendaCacheSummary {
  /** The firm's zone from the newest agenda answer; null before the first one. */
  timeZone: string | null;
  /** Every lawyer that appears in an agenda already loaded in this session, by id. */
  lawyers: NamedRef[];
}

/**
 * A serialized summary of the agenda queries in the cache. A string, so useSyncExternalStore
 * sees an equal snapshot (and skips the render) while nothing relevant changed.
 */
function cacheSnapshot(queryClient: QueryClient): string {
  let timeZone: string | null = null;
  let newest = -1;
  const lawyers = new Map<string, string>();
  for (const query of queryClient.getQueryCache().findAll({ queryKey: [AGENDA_KEY] })) {
    const view = query.state.data as AgendaView | undefined;
    if (!view) continue;
    if (query.state.dataUpdatedAt > newest) {
      newest = query.state.dataUpdatedAt;
      timeZone = view.timeZone;
    }
    for (const item of view.items) {
      for (const lawyer of item.lawyers) lawyers.set(lawyer.id, lawyer.name);
    }
  }
  return JSON.stringify({ timeZone, lawyers: [...lawyers].sort(([a], [b]) => a.localeCompare(b)) });
}

/**
 * What the loaded agendas tell us about the firm: its time zone and its lawyers. There is no
 * endpoint that lists the firm's users yet (ADR-0023), so the lawyer filter offers the ones
 * seen so far. Subscribed to the query cache: an agenda loaded anywhere updates the filter.
 */
export function useAgendaCache(): AgendaCacheSummary {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  const snapshot = useSyncExternalStore(subscribe, () => cacheSnapshot(queryClient));
  return useMemo(() => {
    const parsed = JSON.parse(snapshot) as { timeZone: string | null; lawyers: [string, string][] };
    return {
      timeZone: parsed.timeZone,
      lawyers: parsed.lawyers.map(([id, name]) => ({ id, name })),
    };
  }, [snapshot]);
}
