import type {
  CaseDetail,
  CaseHearing,
  CasePage,
  CoerciveMeasure,
} from "@/features/cases/case-types";
import { apiFetch } from "@/lib/api";

/** Results per page of the case list. */
export const CASE_PAGE_SIZE = 20;

export interface CaseQuery {
  /** Caption, internal number, MPF legajo or OFIJU number. */
  q?: string;
  includeArchived: boolean;
  /** Only the cases of this practice area. */
  area?: string;
  /** From 0. */
  page: number;
}

export function fetchCases(query: CaseQuery, signal?: AbortSignal): Promise<CasePage> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(CASE_PAGE_SIZE),
  });
  if (query.q) params.set("q", query.q);
  if (query.includeArchived) params.set("includeArchived", "true");
  if (query.area) params.set("area", query.area);
  return apiFetch<CasePage>(`/api/v1/cases?${params.toString()}`, { signal });
}

export function fetchCase(id: string, signal?: AbortSignal): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/api/v1/cases/${encodeURIComponent(id)}`, { signal });
}

/** Every hearing of the case, newest first (archived ones left out). */
export function fetchCaseHearings(caseId: string, signal?: AbortSignal): Promise<CaseHearing[]> {
  return apiFetch<CaseHearing[]>(`/api/v1/cases/${encodeURIComponent(caseId)}/hearings`, {
    signal,
  });
}

export function fetchCoerciveMeasures(
  defendantId: string,
  signal?: AbortSignal,
): Promise<CoerciveMeasure[]> {
  return apiFetch<CoerciveMeasure[]>(
    `/api/v1/defendants/${encodeURIComponent(defendantId)}/coercive-measures`,
    { signal },
  );
}
