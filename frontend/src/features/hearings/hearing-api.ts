// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import type { CaseHearing } from "../cases/case-types";
import { apiFetch } from "../../lib/api";

/** Who asked for the hearing (backend `RequestedBy`). */
export type RequestedBy = "DEFENCE" | "PROSECUTION" | "PRIVATE_PROSECUTION" | "COURT" | "OTHER";

/**
 * Another hearing that overlaps for one of the lawyers (backend `ClashView`): a warning, never
 * an error. For a reserved case the user cannot see, the case is hidden and `reserved` is set.
 */
export interface Clash {
  hearingId: string;
  /** The lawyer who is booked twice. */
  userId: string;
  startsAt: string;
  caseId: string | null;
  caseCaption: string | null;
  reserved: boolean;
}

/** `GET/POST/PUT` of one hearing (backend `HearingDetail`). */
export interface HearingDetail extends CaseHearing {
  requestedBy: RequestedBy | null;
  clashes: Clash[];
}

/**
 * The editable fields (backend `HearingData`). An update is a full replace, so the form sends
 * back what it does not show (result, held-as type); the date only changes by rescheduling.
 */
export interface HearingData {
  typeCode: string;
  startsAt: string;
  durationMinutes: number;
  room: string | null;
  judge: string | null;
  ofijuReference: string | null;
  requestedBy: RequestedBy | null;
  statusCode: string;
  cancellationReasonCode: string | null;
  heldAsTypeCode: string | null;
  resultSummary: string | null;
  notes: string | null;
  defendantIds: string[];
  lawyerIds: string[];
}

export function fetchHearing(id: string, signal?: AbortSignal): Promise<HearingDetail> {
  return apiFetch<HearingDetail>(`/api/v1/hearings/${encodeURIComponent(id)}`, { signal });
}

export function createHearing(caseId: string, data: HearingData): Promise<HearingDetail> {
  return apiFetch<HearingDetail>(`/api/v1/cases/${encodeURIComponent(caseId)}/hearings`, {
    method: "POST",
    body: data,
  });
}

export function updateHearing(id: string, data: HearingData): Promise<HearingDetail> {
  return apiFetch<HearingDetail>(`/api/v1/hearings/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}

/** Moves the hearing to another date; it becomes "reprogramada" and keeps the history. */
export function rescheduleHearing(
  id: string,
  change: { startsAt: string; reason: string | null },
): Promise<HearingDetail> {
  return apiFetch<HearingDetail>(`/api/v1/hearings/${encodeURIComponent(id)}/reschedule`, {
    method: "POST",
    body: change,
  });
}
