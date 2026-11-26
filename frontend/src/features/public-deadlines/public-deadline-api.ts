import type {
  PublicCalculation,
  PublicCalculationRequest,
  PublicRule,
} from "@/features/public-deadlines/public-deadline-types";
import { apiFetch } from "@/lib/api";

const PUBLIC = "/api/v1/public";

/** Anonymous and rate-limited (ADR-0041): no session, no CSRF. */
export function fetchPublicRules(signal?: AbortSignal): Promise<PublicRule[]> {
  return apiFetch<PublicRule[]>(`${PUBLIC}/deadline-rules`, { signal });
}

/** A GET that only computes: the server stores nothing of what was asked. */
export function calculatePublicDeadline(
  request: PublicCalculationRequest,
): Promise<PublicCalculation> {
  const query = new URLSearchParams({ rule: request.rule, startDate: request.startDate });
  if (request.startTime) query.set("startTime", request.startTime);
  return apiFetch<PublicCalculation>(`${PUBLIC}/deadline-calculation?${query.toString()}`);
}
