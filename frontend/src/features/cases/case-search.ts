/**
 * The case list's state in the URL, so a search can be bookmarked or shared: `?q=robo`,
 * `?pagina=2` (from 1, as people count pages), `?archivadas=si`. Defaults are left out.
 */
export interface CaseListSearch {
  q?: string;
  pagina?: number;
  archivadas?: "si";
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
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A case id as the backend writes it; anything else cannot be a case. */
export function isCaseId(value: string): boolean {
  return UUID.test(value);
}
