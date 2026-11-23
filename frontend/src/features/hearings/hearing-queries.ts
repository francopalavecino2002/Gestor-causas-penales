import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createHearing,
  fetchHearing,
  rescheduleHearing,
  updateHearing,
  type HearingData,
  type HearingDetail,
} from "@/features/hearings/hearing-api";

/** One hearing, to edit it; idle without an id (a new hearing). */
export function useHearing(id: string | undefined) {
  return useQuery({
    queryKey: ["hearing", id ?? ""] as const,
    queryFn: ({ signal }) => fetchHearing(id ?? "", signal),
    enabled: id !== undefined,
  });
}

/** A hearing shows in the agenda, in its case (list and summary) and in the case list. */
function invalidateAfterHearing(queryClient: QueryClient, saved: HearingDetail) {
  queryClient.setQueryData(["hearing", saved.id], saved);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["agenda"] }),
    queryClient.invalidateQueries({ queryKey: ["case", saved.caseId] }),
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
  ]);
}

export function useCreateHearing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { caseId: string; data: HearingData }) =>
      createHearing(variables.caseId, variables.data),
    onSuccess: (saved) => invalidateAfterHearing(queryClient, saved),
  });
}

/**
 * When the date changed, reschedules first (the backend only moves a date that way, and a
 * refused reschedule then saves nothing), then saves the fields. The caches are refreshed
 * whatever happens, since the reschedule may have gone through when the edit fails.
 */
export function useUpdateHearing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: {
      id: string;
      caseId: string;
      data: HearingData;
      reschedule?: { startsAt: string; reason: string | null };
    }) => {
      if (variables.reschedule) await rescheduleHearing(variables.id, variables.reschedule);
      return updateHearing(variables.id, variables.data);
    },
    onSuccess: (saved) => queryClient.setQueryData(["hearing", saved.id], saved),
    onSettled: (saved, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agenda"] }),
        queryClient.invalidateQueries({ queryKey: ["case", saved?.caseId ?? variables.caseId] }),
        queryClient.invalidateQueries({ queryKey: ["hearing", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
      ]),
  });
}
