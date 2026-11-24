import type { TaskData, TaskFilter, TaskPage, TaskView } from "@/features/tasks/task-types";
import { apiFetch } from "@/lib/api";

const TASKS = "/api/v1/tasks";

/** The query string of a search: only the filters that are on. */
export function taskSearchParams(filter: TaskFilter, page: number, size: number): string {
  const params = new URLSearchParams();
  if (filter.scope) params.set("scope", filter.scope);
  if (filter.responsible) params.set("responsible", filter.responsible);
  if (filter.caseId) params.set("caseId", filter.caseId);
  if (filter.hearingId) params.set("hearingId", filter.hearingId);
  if (filter.status) params.set("status", filter.status);
  if (filter.overdue) params.set("overdue", "true");
  if (filter.dueOn) params.set("dueOn", filter.dueOn);
  params.set("page", String(page));
  params.set("size", String(size));
  return params.toString();
}

export function fetchTasks(
  filter: TaskFilter,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<TaskPage> {
  return apiFetch<TaskPage>(`${TASKS}?${taskSearchParams(filter, page, size)}`, { signal });
}

export function createTask(data: TaskData): Promise<TaskView> {
  return apiFetch<TaskView>(TASKS, { method: "POST", body: data });
}

export function updateTask(taskId: string, data: TaskData): Promise<TaskView> {
  return apiFetch<TaskView>(`${TASKS}/${taskId}`, { method: "PUT", body: data });
}

/** Any member can mark a task done or pending again. */
export function setTaskDone(taskId: string, done: boolean): Promise<TaskView> {
  return apiFetch<TaskView>(`${TASKS}/${taskId}/${done ? "done" : "reopen"}`, { method: "POST" });
}

/** Nothing is deleted: a task is archived, and can be restored. */
export function setTaskArchived(taskId: string, archived: boolean): Promise<void> {
  return apiFetch(`${TASKS}/${taskId}/${archived ? "archive" : "restore"}`, { method: "POST" });
}
