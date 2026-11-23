import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchCaseDeadlines, fetchUpcomingDeadlines } from "@/features/deadlines/deadline-api";

/** Keeps the previous horizon on screen while the next one loads, so the list does not jump. */
export function useUpcomingDeadlines(withinDays: number) {
  return useQuery({
    queryKey: ["deadlines", withinDays] as const,
    queryFn: ({ signal }) => fetchUpcomingDeadlines(withinDays, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCaseDeadlines(caseId: string) {
  return useQuery({
    queryKey: ["case", caseId, "deadlines"] as const,
    queryFn: ({ signal }) => fetchCaseDeadlines(caseId, signal),
  });
}
