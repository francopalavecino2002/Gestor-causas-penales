/*
 * Fictitious tasks for the week of Monday 23 November 2026 (FIXTURE_NOW), shared by the Vitest
 * suite and the Playwright mock backend, plus a small stateful stand-in for `/api/v1/tasks`.
 * Titles, names and captions are made up.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type { IsoDate } from "../features/agenda/agenda-types";
import type { TaskData, TaskPage, TaskView } from "../features/tasks/task-types";
import { LAWYER_HUGO, LAWYER_LUCIA, LAWYER_PAULA, MONDAY_HEARINGS } from "./agenda-fixtures";
import { CASE_EJEMPLO, CASE_MODELO, CASE_MUESTRA } from "./case-fixtures";

/** "Today" for the fixtures: Monday 23 November 2026 in Neuquén. */
export const TASK_TODAY: IsoDate = "2026-11-23";

const MODELO_REVIEW = MONDAY_HEARINGS[2];

const member = (ref: { id: string; name: string }) => ({ id: ref.id, displayName: ref.name });

function task(n: number, overrides: Partial<TaskView>): TaskView {
  return {
    id: `00000000-0000-4000-b000-${String(n).padStart(12, "0")}`,
    title: "Tarea ficticia",
    notes: null,
    dueDate: null,
    status: "PENDING",
    overdue: false,
    doneAt: null,
    responsible: member(LAWYER_LUCIA),
    createdBy: LAWYER_LUCIA.id,
    caseRef: null,
    hearing: null,
    archived: false,
    createdAt: "2026-11-16T12:00:00Z",
    ...overrides,
  };
}

/** Overdue since Friday: the user's. */
export const TASK_LEGAJO_COPY = task(1, {
  title: "Pedir copia del legajo a la fiscalía",
  dueDate: "2026-11-20",
  overdue: true,
  caseRef: { id: CASE_MODELO.id, caption: CASE_MODELO.caption },
});

/** Due today, for this morning's preventive-prison review. */
export const TASK_REVIEW_BRIEF = task(2, {
  title: "Preparar los argumentos para la revisión de la prisión preventiva",
  notes: "Llevar el informe socioambiental ficticio y la constancia de domicilio.",
  dueDate: TASK_TODAY,
  caseRef: { id: CASE_MODELO.id, caption: CASE_MODELO.caption },
  hearing: {
    id: MODELO_REVIEW?.hearingId ?? "00000000-0000-4000-9000-000000000003",
    typeCode: "revision-de-prision-preventiva",
    typeName: "Revisión de prisión preventiva",
    startsAt: MODELO_REVIEW?.startsAt ?? "2026-11-23T14:00:00Z",
  },
});

export const TASK_FAMILY_CALL = task(3, {
  title: "Llamar a la familia para coordinar la visita",
  dueDate: TASK_TODAY,
  caseRef: { id: CASE_EJEMPLO.id, caption: CASE_EJEMPLO.caption },
});

/** Without a case: firm housekeeping. */
export const TASK_WEEK_REVIEW = task(4, {
  title: "Revisar la agenda de la semana que viene",
  dueDate: "2026-11-27",
});

/** Paula's, created by the user. */
export const TASK_EVIDENCE_BRIEF = task(5, {
  title: "Presentar el escrito de ofrecimiento de prueba",
  dueDate: "2026-11-25",
  responsible: member(LAWYER_PAULA),
  caseRef: { id: CASE_EJEMPLO.id, caption: CASE_EJEMPLO.caption },
});

/** Done on Sunday. */
export const TASK_NOTICE_PICKUP = task(6, {
  title: "Retirar la cédula en la Oficina Judicial",
  dueDate: "2026-11-22",
  status: "DONE",
  doneAt: "2026-11-22T14:10:00Z",
  caseRef: { id: CASE_MUESTRA.id, caption: CASE_MUESTRA.caption },
});

/** Hugo's own, overdue: the user can mark it done but not edit it unless an owner or lawyer. */
export const TASK_HUGO_NOTICE = task(7, {
  title: "Controlar la notificación de la audiencia",
  dueDate: "2026-11-19",
  overdue: true,
  responsible: member(LAWYER_HUGO),
  createdBy: LAWYER_HUGO.id,
  caseRef: { id: CASE_MUESTRA.id, caption: CASE_MUESTRA.caption },
});

export const ALL_TASKS: TaskView[] = [
  TASK_LEGAJO_COPY,
  TASK_REVIEW_BRIEF,
  TASK_FAMILY_CALL,
  TASK_WEEK_REVIEW,
  TASK_EVIDENCE_BRIEF,
  TASK_NOTICE_PICKUP,
  TASK_HUGO_NOTICE,
];

/** The query string of `GET /api/v1/tasks`, as plain strings. */
export type TaskQuery = Partial<Record<string, string | null>>;

/** Overdue first, then the soonest due day (no day last), then the oldest: the backend's order. */
function compare(a: TaskView, b: TaskView): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

/** What `GET /api/v1/tasks` answers, filtered and paged like the real search. */
export function taskPageFor(tasks: TaskView[], query: TaskQuery, meId: string): TaskPage {
  const size = Number(query.size ?? 20);
  const page = Number(query.page ?? 0);
  const responsible = query.scope === "mine" ? meId : query.responsible;
  const matches = tasks
    .filter(
      (item) =>
        (query.includeArchived === "true" || !item.archived) &&
        (!responsible || item.responsible.id === responsible) &&
        (!query.caseId || item.caseRef?.id === query.caseId) &&
        (!query.hearingId || item.hearing?.id === query.hearingId) &&
        (!query.status || item.status === query.status) &&
        (query.overdue !== "true" || item.overdue) &&
        (!query.dueOn || item.dueDate === query.dueOn),
    )
    .sort(compare);
  return {
    items: matches.slice(page * size, page * size + size),
    page,
    size,
    total: matches.length,
  };
}

const MEMBER_NAMES: Record<string, string> = {
  [LAWYER_LUCIA.id]: LAWYER_LUCIA.name,
  [LAWYER_PAULA.id]: LAWYER_PAULA.name,
  [LAWYER_HUGO.id]: LAWYER_HUGO.name,
};

const CASE_CAPTIONS: Record<string, string> = Object.fromEntries(
  [CASE_MODELO, CASE_EJEMPLO, CASE_MUESTRA].map((item) => [item.id, item.caption]),
);

/**
 * A stateful `/api/v1/tasks` over a copy of the fixtures, so a change shows up in the next GET.
 * Answers undefined when the request is not one of its routes.
 */
export function tasksBackend(initial: TaskView[] = ALL_TASKS, meId: string = LAWYER_LUCIA.id) {
  const tasks: TaskView[] = structuredClone(initial);
  let next = 100;

  const withOverdue = (item: TaskView): TaskView => ({
    ...item,
    overdue:
      item.status === "PENDING" &&
      !item.archived &&
      item.dueDate !== null &&
      item.dueDate < TASK_TODAY,
  });

  const fromData = (data: TaskData, base: TaskView): TaskView => {
    const hearing =
      data.hearingId === null
        ? null
        : (ALL_TASKS.find((item) => item.hearing?.id === data.hearingId)?.hearing ??
          base.hearing ?? {
            id: data.hearingId,
            typeCode: "audiencia",
            typeName: "Audiencia",
            startsAt: `${TASK_TODAY}T14:00:00Z`,
          });
    const caseId =
      data.caseId ??
      (data.hearingId
        ? (ALL_TASKS.find((item) => item.hearing?.id === data.hearingId)?.caseRef?.id ??
          CASE_MODELO.id)
        : null);
    return withOverdue({
      ...base,
      title: data.title,
      notes: data.notes,
      dueDate: data.dueDate,
      responsible: {
        id: data.responsibleUserId,
        displayName: MEMBER_NAMES[data.responsibleUserId] ?? "Tomás Muestra",
      },
      caseRef: caseId ? { id: caseId, caption: CASE_CAPTIONS[caseId] ?? "Causa ficticia" } : null,
      hearing,
    });
  };

  return (
    method: string,
    path: string,
    query: TaskQuery,
    body: () => unknown,
  ): { status: number; json?: unknown } | undefined => {
    if (path === "/api/v1/tasks") {
      if (method === "GET") return { status: 200, json: taskPageFor(tasks, query, meId) };
      if (method === "POST") {
        const created = fromData(
          body() as TaskData,
          task(next++, { createdBy: meId, createdAt: "2026-11-23T13:20:00Z" }),
        );
        tasks.push(created);
        return { status: 201, json: created };
      }
      return undefined;
    }
    const match = /^\/api\/v1\/tasks\/([0-9a-f-]+)(?:\/(done|reopen|archive|restore))?$/.exec(path);
    if (!match) return undefined;
    const index = tasks.findIndex((item) => item.id === match[1]);
    const current = tasks[index];
    if (!current) return { status: 404 };
    const action = match[2];
    if (method === "PUT" && !action) {
      tasks[index] = fromData(body() as TaskData, current);
      return { status: 200, json: tasks[index] };
    }
    if (method !== "POST" || !action) return undefined;
    if (action === "done" || action === "reopen") {
      tasks[index] = withOverdue({
        ...current,
        status: action === "done" ? "DONE" : "PENDING",
        doneAt: action === "done" ? "2026-11-23T13:25:00Z" : null,
      });
      return { status: 200, json: tasks[index] };
    }
    tasks[index] = withOverdue({ ...current, archived: action === "archive" });
    return { status: 204 };
  };
}
