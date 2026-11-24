/**
 * The case list's state in the URL, so a search can be bookmarked or shared: `?q=robo`,
 * `?pagina=2` (from 1, as people count pages), `?archivadas=si`, `?fuero=civil`. Defaults are
 * left out.
 */
export interface CaseListSearch {
  q?: string;
  pagina?: number;
  archivadas?: "si";
  /** Only the cases of this practice area (a code, as the API spells it). */
  fuero?: string;
}

/** A practice area code: lowercase words and hyphens, as the jurisdiction packages write them. */
const AREA_CODE = /^[a-z][a-z0-9-]{0,39}$/;

/** A practice area code from the URL, or undefined (any area). */
export function parseAreaCode(value: unknown): string | undefined {
  return typeof value === "string" && AREA_CODE.test(value) ? value : undefined;
}

/** Longest search text sent to the API; longer input is cut, never rejected. */
const MAX_QUERY = 100;

/** No firm has this many pages; a bigger number is a typo or a forged link. */
export const MAX_PAGE = 100_000;

/**
 * A scalar search value as text. TanStack Router JSON-parses values, so `?q=123989` (a bare
 * legajo number) arrives as a number; arrays and objects are not valid here.
 */
function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Keeps only valid values: a hand-edited or stale link falls back to the defaults. */
export function parseCaseListSearch(search: Record<string, unknown>): CaseListSearch {
  const q = scalar(search.q)?.trim().slice(0, MAX_QUERY);
  const pageText = scalar(search.pagina);
  const page = pageText !== undefined && /^\d+$/.test(pageText) ? Number(pageText) : NaN;
  return {
    q: q || undefined,
    pagina: page > 1 && page <= MAX_PAGE ? page : undefined,
    archivadas: search.archivadas === "si" ? "si" : undefined,
    fuero: parseAreaCode(search.fuero),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A case id as the backend writes it; anything else cannot be a case. */
export function isCaseId(value: string): boolean {
  return UUID.test(value);
}
