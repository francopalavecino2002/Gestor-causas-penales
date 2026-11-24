import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchAvailablePracticeAreas,
  fetchPracticeAreas,
  replaceEnabledPracticeAreas,
} from "@/features/practice-areas/practice-area-api";
import type { PracticeArea } from "@/features/practice-areas/practice-area-types";

const AREAS_KEY = ["practice-areas"] as const;

/**
 * The areas the firm works in. They change only in Ajustes, so they stay fresh for the session;
 * a failure is not retried on every mount (screens fall back to the criminal area, the default).
 */
export function usePracticeAreas() {
  return useQuery({
    queryKey: [...AREAS_KEY, "enabled"] as const,
    queryFn: ({ signal }) => fetchPracticeAreas(signal),
    // Another session (the owner in Ajustes) can change them: refresh on focus after a minute.
    staleTime: 60_000,
    retryOnMount: false,
  });
}

/**
 * What the screens need to tell areas apart: the enabled areas, whether there is more than one
 * (only then the area shows as a badge and a filter), and an area by code.
 */
export function useAreaDirectory() {
  const query = usePracticeAreas();
  const areas = query.data ?? [];
  return {
    areas,
    isPending: query.isPending,
    multiple: areas.length > 1,
    find: (code: string | null | undefined): PracticeArea | undefined =>
      areas.find((area) => area.code === code),
  };
}

export function useAvailablePracticeAreas() {
  return useQuery({
    queryKey: [...AREAS_KEY, "available"] as const,
    queryFn: ({ signal }) => fetchAvailablePracticeAreas(signal),
  });
}

/**
 * After a change every screen reads the new list: the forms, the filters, the catalogs.
 * `changed` is the area the user switched, so the screen can name it in a message.
 */
export function useReplaceEnabledPracticeAreas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { codes: string[]; changed?: string }) =>
      replaceEnabledPracticeAreas(variables.codes),
    onSuccess: (available) => {
      queryClient.setQueryData([...AREAS_KEY, "available"], available);
      return queryClient.invalidateQueries({ queryKey: AREAS_KEY });
    },
  });
}
