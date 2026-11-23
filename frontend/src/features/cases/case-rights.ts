import type { Me } from "@/features/auth/auth-api";
import type { CaseDetail } from "@/features/cases/case-types";

/**
 * What the signed-in user may change in a case, by the backend's rules (CasePermissions,
 * CaseAccess, HearingService): whoever sees a case edits it, its defendants and its hearings
 * while it is not archived; only the owner or the case's responsible changes the reserved flag.
 * Every role may open a case (CaseService.create).
 */
export interface CaseRights {
  edit: boolean;
  changeReserved: boolean;
}

export function caseRights(
  me: Pick<Me, "id" | "role"> | null | undefined,
  detail: CaseDetail,
): CaseRights {
  if (!me || detail.archived) return { edit: false, changeReserved: false };
  const responsible = detail.team.find((member) => member.role === "RESPONSIBLE");
  return {
    edit: true,
    changeReserved: me.role === "OWNER" || responsible?.userId === me.id,
  };
}
