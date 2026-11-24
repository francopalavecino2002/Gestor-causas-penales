import type { IsoDate } from "../agenda/agenda-types";

// Relative import: the e2e mock backend reads these types through the fixtures.

/** Where a task stands (backend `TaskStatus`): pendiente or hecha. */
export type TaskStatus = "PENDING" | "DONE";

/** A task with the small references the screens show (backend `TaskView`). */
export interface TaskView {
  id: string;
  title: string;
  notes: string | null;
  /** The day it is due in the firm's zone; null for a task without a due day. */
  dueDate: IsoDate | null;
  status: TaskStatus;
  /** Pending, not archived and due before today in the firm's zone. */
  overdue: boolean;
  /** When it was marked done; null while pending. */
  doneAt: string | null;
  responsible: { id: string; displayName: string };
  createdBy: string;
  /** The linked case; null without one, or when it is a reserved case the user cannot see. */
  caseRef: { id: string; caption: string } | null;
  hearing: { id: string; typeCode: string; typeName: string; startsAt: string } | null;
  archived: boolean;
  createdAt: string;
}

/** One page of tasks; `page` starts at 0 (backend `TaskPage`). */
export interface TaskPage {
  items: TaskView[];
  page: number;
  size: number;
  total: number;
}

/** What the client sends to create or edit a task (backend `TaskData`). */
export interface TaskData {
  title: string;
  notes: string | null;
  dueDate: IsoDate | null;
  responsibleUserId: string;
  caseId: string | null;
  hearingId: string | null;
}

/**
 * The filters of `GET /api/v1/tasks`. Overdue first, then the soonest due day. `scope: "mine"`
 * lists the user's own tasks; `responsible` someone else's.
 */
export interface TaskFilter {
  scope?: "mine";
  responsible?: string;
  caseId?: string;
  hearingId?: string;
  status?: TaskStatus;
  overdue?: boolean;
  dueOn?: IsoDate;
}
