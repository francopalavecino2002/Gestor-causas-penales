import { useMemo } from "react";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

import type { CatalogId, CatalogItem, CatalogView } from "@/features/catalogs/catalog-types";
import { apiFetch } from "@/lib/api";

/**
 * Hidden items included: they are only kept out of new records, and an existing case may still
 * point at one. Catalogs change rarely, so they stay fresh for the session.
 */
export function catalogQueryOptions(id: CatalogId) {
  return queryOptions({
    queryKey: ["catalog", id] as const,
    queryFn: ({ signal }) =>
      apiFetch<CatalogView>(`/api/v1/catalogs/${id}?includeHidden=true`, { signal }),
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
export function useCatalogsSettled(ids: CatalogId[]): boolean {
  return useQueries({
    queries: ids.map((id) => catalogQueryOptions(id)),
    combine: (results) => results.every((result) => !result.isPending),
  });
}

/**
 * The catalog's items by code. Empty while it loads or if it fails: screens fall back to what
 * the record itself says (its code), so a missing catalog never blocks a case from showing.
 */
export function useCatalogItems(id: CatalogId): Map<string, CatalogItem> {
  const { data } = useQuery(catalogQueryOptions(id));
  return useMemo(() => new Map((data?.items ?? []).map((item) => [item.code, item])), [data]);
}
