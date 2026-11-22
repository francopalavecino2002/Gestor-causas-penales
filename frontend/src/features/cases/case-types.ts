// Relative imports only: the e2e project (tsconfig.node.json) uses these types through the
// fixtures and has no "@/" alias.
import type { IsoDate, NamedRef } from "../agenda/agenda-types";

/** How the criminal action is exercised (backend `ActionType`), with its CPP article. */
export type ActionType = "PUBLIC" | "PUBLIC_ON_COMPLAINT" | "PRIVATE";

/** Whom the firm represents in the case (backend `Representation`). */
export type Representation = "DEFENCE" | "PRIVATE_PROSECUTION";

/** Where a defendant stands inside their stage (backend `DefendantStatus`). */
export type DefendantStatus = "ACTIVE" | "SUSPENDED" | "IN_MEDIATION" | "CLOSED";

/** Privately hired or public defender (backend `CounselKind`). */
export type CounselKind = "PRIVATE" | "PUBLIC";

/** The part a firm member plays in one case (backend `TeamRole`). */
export type TeamRole = "RESPONSIBLE" | "COLLABORATOR" | "PARALEGAL";

/** The next pending hearing of a case (backend `NextHearing`). */
export interface NextHearing {
  id: string;
  /** ISO instant. */
  startsAt: string;
  /** Code of the hearing-types catalog. */
  typeCode: string;
}

/** What a case shows at a glance, computed from its defendants and hearings (`CaseSummary`). */
export interface CaseSummary {
  defendantCount: number;
  openDefendantCount: number;
  /** Stage code (stages catalog) of the most delayed open defendant; null without defendants. */
  mostDelayedStage: string | null;
  /** Active defendants with an active custodial measure. */
  detaineeCount: number;
  nextHearing: NextHearing | null;
}

/** A case in the list and as the head of the detail (backend `CaseView`). */
export interface CaseView {
  id: string;
  caption: string;
  internalNumber: string | null;
  /** "MPFNQ 123989/2018". */
  mpfLegajo: string | null;
  ofijuNumber: string | null;
  pehuenNumber: string | null;
  circumscriptionCode: string;
  circumscriptionName: string;
  actionType: ActionType;
  /** CPP article that defines the action type, e.g. "99". */
  actionArticle: string;
  represents: Representation;
  reserved: boolean;
  archived: boolean;
  /** ISO instant. */
  createdAt: string;
  summary: CaseSummary;
}

/** `GET /api/v1/cases`: one page of results, `page` from 0. */
export interface CasePage {
  items: CaseView[];
  page: number;
  size: number;
  total: number;
}

export interface ChargeView {
  id: string;
  offence: string;
  legalReference: string | null;
}

/** A defendant of the case (backend `DefendantView`). */
export interface DefendantView {
  id: string;
  personId: string;
  displayName: string;
  personArchived: boolean;
  stageCode: string;
  stageName: string;
  status: DefendantStatus;
  closingOutcomeCode: string | null;
  closingOutcomeName: string | null;
  chargesFormulatedOn: IsoDate | null;
  defendedByFirm: boolean;
  defenceCounselKind: CounselKind | null;
  defenceCounselName: string | null;
  rebellionDeclaredOn: IsoDate | null;
  rebellionLiftedOn: IsoDate | null;
  indigenousPeople: boolean | null;
  createdAt: string;
  charges: ChargeView[];
  customFields: Record<string, unknown>;
}

/** A person with a role in the case (backend `PartyView`). */
export interface PartyView {
  id: string;
  personId: string;
  displayName: string;
  personArchived: boolean;
  roleCode: string;
  roleName: string;
}

export interface TeamMemberView {
  userId: string;
  displayName: string;
  role: TeamRole;
}

/** `GET /api/v1/cases/{id}` (backend `CaseDetail`). */
export interface CaseDetail extends CaseView {
  customFields: Record<string, unknown>;
  team: TeamMemberView[];
  parties: PartyView[];
  defendants: DefendantView[];
}

/** A hearing of `GET /api/v1/cases/{caseId}/hearings`, newest first (backend `HearingView`). */
export interface CaseHearing {
  id: string;
  caseId: string;
  caseCaption: string;
  typeCode: string;
  typeName: string;
  typeArticle: string | null;
  startsAt: string;
  durationMinutes: number;
  room: string | null;
  judge: string | null;
  ofijuReference: string | null;
  requestedBy: string | null;
  statusCode: string;
  statusName: string;
  cancellationReasonCode: string | null;
  cancellationReasonName: string | null;
  heldAsTypeCode: string | null;
  heldAsTypeName: string | null;
  resultSummary: string | null;
  nextHearingId: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  defendants: NamedRef[];
  lawyers: NamedRef[];
}

/** `GET /api/v1/defendants/{id}/coercive-measures` item (backend `CoerciveMeasureView`). */
export interface CoerciveMeasure {
  id: string;
  defendantId: string;
  measureCode: string;
  measureName: string;
  measureArticle: string | null;
  conditions: string | null;
  detentionPlace: string | null;
  proceduralRisks: { code: string; name: string }[];
  startsOn: IsoDate;
  endsOn: IsoDate | null;
  nextReviewOn: IsoDate | null;
  orderedByHearingId: string | null;
  liftedOn: IsoDate | null;
  /** Neither archived nor lifted. */
  active: boolean;
  archived: boolean;
  createdAt: string;
}
