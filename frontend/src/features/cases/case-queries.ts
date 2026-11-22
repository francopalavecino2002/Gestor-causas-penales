import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import {
  fetchCase,
  fetchCaseHearings,
  fetchCases,
  fetchCoerciveMeasures,
  type CaseQuery,
} from "@/features/cases/case-api";

export function casesQueryOptions(query: CaseQuery) {
  return queryOptions({
    queryKey: ["cases", query.q ?? "", query.includeArchived, query.page] as const,
    queryFn: ({ signal }) => fetchCases(query, signal),
  });
}

/** Keeps the previous page on screen while the next one loads, so the list does not jump. */
export function useCases(query: CaseQuery) {
  return useQuery({ ...casesQueryOptions(query), placeholderData: keepPreviousData });
}

export function caseQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["case", id] as const,
    queryFn: ({ signal }) => fetchCase(id, signal),
  });
}

export function useCase(id: string) {
  return useQuery(caseQueryOptions(id));
}

export function useCaseHearings(caseId: string) {
  return useQuery({
    queryKey: ["case", caseId, "hearings"] as const,
    queryFn: ({ signal }) => fetchCaseHearings(caseId, signal),
  });
}

export function useCoerciveMeasures(defendantId: string) {
  return useQuery({
    queryKey: ["defendant", defendantId, "coercive-measures"] as const,
    queryFn: ({ signal }) => fetchCoerciveMeasures(defendantId, signal),
  });
}
