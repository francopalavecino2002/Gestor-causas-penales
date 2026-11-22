import { isIsoDate } from "@/features/agenda/agenda-dates";
import type { IsoDate } from "@/features/agenda/agenda-types";

export type AgendaViewMode = "dia" | "semana";

/**
 * The agenda's state in the URL, so a view can be bookmarked or shared: `?vista=semana`,
 * `?fecha=2026-11-23`, `?abogado=<user id>`. Defaults (day view, today, the whole firm) are left
 * out of the URL.
 */
export interface AgendaSearch {
  vista?: "semana";
  fecha?: IsoDate;
  abogado?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only valid values: a hand-edited or stale link falls back to the defaults. */
export function parseAgendaSearch(search: Record<string, unknown>): AgendaSearch {
  return {
    vista: search.vista === "semana" ? "semana" : undefined,
    fecha: isIsoDate(search.fecha) ? search.fecha : undefined,
    abogado:
      typeof search.abogado === "string" && UUID.test(search.abogado) ? search.abogado : undefined,
  };
}

export function viewMode(search: AgendaSearch): AgendaViewMode {
  return search.vista ?? "dia";
}
