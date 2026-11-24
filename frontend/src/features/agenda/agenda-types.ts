/** A local calendar day, `YYYY-MM-DD` (the backend's `LocalDate`). */
export type IsoDate = string;

/** A defendant or a lawyer as a hearing shows them. */
export interface NamedRef {
  id: string;
  name: string;
}

/** One hearing of `GET /api/v1/agenda` (backend `AgendaItem`). */
export interface AgendaItem {
  hearingId: string;
  caseId: string;
  caseCaption: string;
  /** Code of the case's practice area ("penal", "civil"...). */
  practiceArea: string;
  typeCode: string;
  typeName: string;
  /** CPP article(s) of the hearing type, e.g. "118" or "167 a 169"; null for "Otra". */
  typeArticle: string | null;
  statusCode: string;
  statusName: string;
  /** ISO instant. */
  startsAt: string;
  durationMinutes: number;
  room: string | null;
  judge: string | null;
  defendants: NamedRef[];
  lawyers: NamedRef[];
  /** A listed defendant has an active custodial measure. */
  detainee: boolean;
  /** Overlaps another hearing of one of its lawyers. */
  hasClash: boolean;
}

/** `GET /api/v1/agenda`: local days in the firm's time zone, `to` inclusive. */
export interface AgendaView {
  from: IsoDate;
  to: IsoDate;
  /** IANA zone of the firm, e.g. "America/Argentina/Salta". */
  timeZone: string;
  items: AgendaItem[];
}

export type DetaineeAlertKind = "ENDS" | "REVIEW" | "MAX_DURATION" | "NO_DURATION";

/** `GET /api/v1/detainee-alerts` item (backend `DetaineeAlertView`). */
export interface DetaineeAlert {
  kind: DetaineeAlertKind;
  /** Null for NO_DURATION. */
  dueOn: IsoDate | null;
  /** Calendar days from today; negative when overdue; null for NO_DURATION. */
  daysLeft: number | null;
  article: string;
  caseId: string;
  caseCaption: string;
  defendantId: string;
  defendantName: string;
  measureId: string;
  disclaimer: string;
}
