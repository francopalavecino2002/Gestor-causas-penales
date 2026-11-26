import type { IsoDate } from "../agenda/agenda-types";

// Relative import: the e2e mock backend reads these types through the fixtures.

/** What an entry of the wall is about (backend `NewsKind`). */
export type NewsKind =
  "CASE_OPENED" | "HEARING_SCHEDULED" | "HEARING_RESCHEDULED" | "HEARING_RESULT" | "POST";

/** Who did it; `displayName` is null only for a member whose record vanished. */
export interface NewsActor {
  id: string;
  displayName: string | null;
}

export interface NewsCaseLink {
  id: string;
  caption: string;
  practiceArea: string;
}

/** The hearing of a hearing entry (backend `NewsItem.HearingLink`). */
export interface NewsHearingLink {
  id: string;
  typeCode: string;
  typeName: string;
  /** The hearing's date now. */
  startsAt: string;
  /** The date before a reschedule; null on other kinds. */
  previousStartsAt: string | null;
  /** The date a reschedule set (another reschedule may have moved it since). */
  newStartsAt: string | null;
  /** The status a result entry set; null on other kinds. */
  statusCode: string | null;
  statusName: string | null;
}

/** A manual post: plain text, archived (never deleted) by its author or the owner. */
export interface NewsPost {
  id: string;
  body: string;
  canArchive: boolean;
}

/** One entry of the wall (backend `NewsItem`). */
export interface NewsItem {
  /** The audit event's id: unique and increasing, newest first. */
  id: number;
  kind: NewsKind;
  occurredAt: string;
  /** Null for work done without a signed-in member (seed data, imports by jobs). */
  actor: NewsActor | null;
  /** The case of a case or hearing entry; null for a post. */
  caseLink: NewsCaseLink | null;
  hearing: NewsHearingLink | null;
  post: NewsPost | null;
}

/**
 * A running deadline inside its alert window (backend `DeadlineAlert`). It always carries the
 * rule's legal source and the disclaimer: the system assists, the lawyer controls.
 */
export interface DeadlineAlert {
  id: string;
  caseId: string;
  caseCaption: string;
  defendantName: string | null;
  ruleName: string;
  source: string;
  detainee: boolean;
  dueOn: IsoDate;
  /** The instant an hour-based deadline ends; null for day-based ones. */
  dueAt: string | null;
  daysLeft: number | null;
  hoursLeft: number | null;
  disclaimer: string;
}

/** One page of the wall, newest first; `dueSoon` only on page 0 (backend `NewsFeed`). */
export interface NewsFeed {
  dueSoon: DeadlineAlert[];
  items: NewsItem[];
  page: number;
  size: number;
  total: number;
}

/** What `POST /api/v1/news/posts` answers (backend `NewsItem.PostView`). */
export type PostView = NewsPost;
