/** The horizons the screen offers, in days ahead. */
export const HORIZONS = [7, 15, 30, 60] as const;

export type Horizon = (typeof HORIZONS)[number];

/** The backend's default (`DeadlineService.DEFAULT_WITHIN_DAYS`): left out of the URL. */
export const DEFAULT_HORIZON: Horizon = 30;

/**
 * The deadlines screen's state in the URL, so a view can be bookmarked or shared: `?dias=7`,
 * `?detenidos=si`. Defaults (30 days, every deadline) are left out.
 */
export interface DeadlineSearch {
  /** Never the default: that one is left out. */
  dias?: Horizon;
  detenidos?: "si";
}

function isHorizon(value: number): value is Horizon {
  return (HORIZONS as readonly number[]).includes(value);
}

/**
 * Keeps only valid values: a hand-edited or stale link falls back to the defaults. TanStack
 * Router JSON-parses values, so `?dias=7` arrives as a number; "7" is accepted too.
 */
export function parseDeadlineSearch(search: Record<string, unknown>): DeadlineSearch {
  const raw = search.dias;
  const days =
    typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : 0;
  return {
    dias: isHorizon(days) && days !== DEFAULT_HORIZON ? days : undefined,
    detenidos: search.detenidos === "si" ? "si" : undefined,
  };
}

export function horizonOf(search: DeadlineSearch): Horizon {
  return search.dias ?? DEFAULT_HORIZON;
}

/** The search for a horizon, with the default left out. */
export function horizonSearch(search: DeadlineSearch, horizon: Horizon): DeadlineSearch {
  return { ...search, dias: horizon === DEFAULT_HORIZON ? undefined : horizon };
}
