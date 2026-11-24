import { useMemo } from "react";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import type { AnyCatalogId, CatalogItem, CatalogView } from "@/features/catalogs/catalog-types";
import { DEFAULT_AREA } from "@/features/practice-areas/practice-area-format";
import { apiFetch } from "@/lib/api";

/**
 * One catalog of one practice area (ADR-0032; catalogs shared by every area, such as the
 * circumscriptions, come the same in each). Hidden items included: they are only kept out of new
 * records, and an existing case may still point at one. Catalogs change rarely, so they stay
 * fresh for the session.
 */
export function catalogQueryOptions(id: AnyCatalogId, area: string = DEFAULT_AREA) {
  return queryOptions({
    queryKey: ["catalog", id, area] as const,
    queryFn: ({ signal }) =>
      apiFetch<CatalogView>(
        `/api/v1/catalogs/${id}?area=${encodeURIComponent(area)}&includeHidden=true`,
        { signal },
      ),
    staleTime: Infinity,
    // A failed catalog without data would go back to "pending" each time a component that reads
    // it mounts, and screens that wait for catalogs would flip between skeleton and content.
    // Screens fall back to the record's own names instead.
    retryOnMount: false,
  });
}

/**
 * Whether the catalogs have answered (or failed). Screens wait for it before showing names, so
 * a raw code never flashes on screen; cached for the session, so the wait happens once.
 */
export function useCatalogsSettled(ids: AnyCatalogId[], area: string = DEFAULT_AREA): boolean {
  return useQueries({
    queries: ids.map((id) => catalogQueryOptions(id, area)),
    combine: (results) => results.every((result) => !result.isPending),
  });
}

/**
 * The catalog's items by code. Empty while it loads or if it fails: screens fall back to what
 * the record itself says (its code), so a missing catalog never blocks a case from showing.
 */
export function useCatalogItems(
  id: AnyCatalogId,
  area: string = DEFAULT_AREA,
): Map<string, CatalogItem> {
  const { data } = useQuery(catalogQueryOptions(id, area));
  return useMemo(() => new Map((data?.items ?? []).map((item) => [item.code, item])), [data]);
}

/**
 * The same catalog for several areas at once (a list mixing cases of different areas), by area
 * and then by code.
 */
export function useCatalogItemsByArea(
  id: AnyCatalogId,
  areas: string[],
): Map<string, Map<string, CatalogItem>> {
  const unique = [...new Set(areas)];
  return useQueries({
    queries: unique.map((area) => catalogQueryOptions(id, area)),
    combine: (results) =>
      new Map(
        results.map((result, index) => [
          unique[index] ?? DEFAULT_AREA,
          new Map((result.data?.items ?? []).map((item) => [item.code, item])),
        ]),
      ),
  });
}

/**
 * What a form offers for a new value: the catalog's items in its order, hidden ones left out,
 * except the record's current value, which stays selectable so an edit never drops it.
 */
export function useCatalogOptions(
  id: AnyCatalogId,
  current?: string | null,
  area: string = DEFAULT_AREA,
) {
  const query = useQuery(catalogQueryOptions(id, area));
  const items = useMemo(
    () => (query.data?.items ?? []).filter((item) => !item.hidden || item.code === (current ?? "")),
    [query.data, current],
  );
  return { items, isPending: query.isPending, isError: query.isError };
}
