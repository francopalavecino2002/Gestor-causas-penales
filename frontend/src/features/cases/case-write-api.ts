// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import type {
  ActionType,
  CaseDetail,
  CaseStatus,
  CounselKind,
  DefendantStatus,
  DefendantView,
  PartyView,
  Representation,
} from "../cases/case-types";
import { apiFetch } from "../../lib/api";

/**
 * The editable fields of a case (backend `CaseData`). `responsibleUserId` and `practiceArea` only
 * count when the case is created (the creator and the criminal area by default; the area never
 * changes); custom fields are left out, so the stored ones stay. `stageCode`, `status` and
 * `closingOutcomeCode` are the case's own course, only in an area without defendants: an update
 * there must send them, a criminal case must not.
 */
export interface CaseData {
  caption: string;
  internalNumber: string | null;
  mpfLegajo: string | null;
  ofijuNumber: string | null;
  pehuenNumber: string | null;
  circumscriptionCode: string;
  actionType: ActionType;
  represents: Representation;
  reserved: boolean;
  responsibleUserId?: string | null;
  practiceArea?: string;
  stageCode?: string | null;
  status?: CaseStatus | null;
  closingOutcomeCode?: string | null;
}

/** A person with a role in the case other than defendant (backend `PartyData`). */
export interface PartyData {
  personId: string;
  /** Code of the area's `party-roles` catalog. */
  roleCode: string;
}

/**
 * The editable fields of a defendant (backend `DefendantData`). An update is a full replace, so
 * the form sends back every value it does not show.
 */
export interface DefendantData {
  personId?: string;
  stageCode: string;
  status: DefendantStatus;
  closingOutcomeCode: string | null;
  chargesFormulatedOn: string | null;
  defendedByFirm: boolean;
  defenceCounselKind: CounselKind | null;
  defenceCounselName: string | null;
  rebellionDeclaredOn: string | null;
  rebellionLiftedOn: string | null;
  indigenousPeople: boolean | null;
}

export function createCase(data: CaseData): Promise<CaseDetail> {
  return apiFetch<CaseDetail>("/api/v1/cases", { method: "POST", body: data });
}

export function updateCase(id: string, data: CaseData): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/api/v1/cases/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}

export function addParty(caseId: string, data: PartyData): Promise<PartyView> {
  return apiFetch<PartyView>(`/api/v1/cases/${encodeURIComponent(caseId)}/parties`, {
    method: "POST",
    body: data,
  });
}

export function addDefendant(caseId: string, data: DefendantData): Promise<DefendantView> {
  return apiFetch<DefendantView>(`/api/v1/cases/${encodeURIComponent(caseId)}/defendants`, {
    method: "POST",
    body: data,
  });
}

export function updateDefendant(
  caseId: string,
  defendantId: string,
  data: DefendantData,
): Promise<DefendantView> {
  return apiFetch<DefendantView>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/defendants/${encodeURIComponent(defendantId)}`,
    { method: "PUT", body: data },
  );
}
