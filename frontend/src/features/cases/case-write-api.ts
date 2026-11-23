// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import type {
  ActionType,
  CaseDetail,
  CounselKind,
  DefendantStatus,
  DefendantView,
  Representation,
} from "../cases/case-types";
import { apiFetch } from "../../lib/api";

/**
 * The editable fields of a case (backend `CaseData`). `responsibleUserId` only counts when the
 * case is created (the creator by default); custom fields are left out, so the stored ones stay.
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
