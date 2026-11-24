import { addDays, formatShortDayLabel, localDay } from "@/features/agenda/agenda-dates";
import type { IsoDate } from "@/features/agenda/agenda-types";
import type { Me, Role } from "@/features/auth/auth-api";
import type { TaskView } from "@/features/tasks/task-types";

/** "1 tarea", "3 tareas". */
export function countTasks(count: number): string {
  return `${count} ${count === 1 ? "tarea" : "tareas"}`;
}

/** "1 vencida", "2 vencidas". */
export function countOverdue(count: number): string {
  return `${count} ${count === 1 ? "vencida" : "vencidas"}`;
}

/**
 * When a task is due, in words: "Vence hoy", "Vence mañana", "Vence el miércoles 25/11",
 * "Venció el viernes 20/11"; a done one says when it was done.
 */
export function dueText(task: TaskView, today: IsoDate, timeZone: string): string {
  if (task.status === "DONE") {
    return task.doneAt
      ? `Hecha el ${formatShortDayLabel(localDay(task.doneAt, timeZone))}`
      : "Hecha";
  }
  const due = task.dueDate;
  if (!due) return "Sin fecha";
  if (due === today) return "Vence hoy";
  if (due === addDays(today, 1)) return "Vence mañana";
  if (due < today) return `Venció el ${formatShortDayLabel(due)}`;
  return `Vence el ${formatShortDayLabel(due)}`;
}

/** Same rule as the backend (TaskPermissions): who can edit, archive and restore a task. */
const MANAGER_ROLES: readonly Role[] = ["OWNER", "LAWYER"];

export function canManageTask(
  me: Pick<Me, "id" | "role"> | null | undefined,
  task: TaskView,
): boolean {
  if (!me) return false;
  return (
    MANAGER_ROLES.includes(me.role) || task.createdBy === me.id || task.responsible.id === me.id
  );
}

/** "Tenés 5 tareas pendientes, 2 vencidas." / "Paula Demo tiene 1 tarea pendiente." */
export function tasksSummary(options: {
  pending: number;
  overdue: number;
  /** Someone else's tasks; the user's own when undefined. */
  personName?: string;
}): string {
  const { pending, overdue, personName } = options;
  const subject = personName ? `${personName} tiene` : "Tenés";
  if (pending === 0) {
    return personName ? `${personName} no tiene tareas pendientes.` : "No tenés tareas pendientes.";
  }
  const count = `${countTasks(pending)} ${pending === 1 ? "pendiente" : "pendientes"}`;
  return overdue > 0 ? `${subject} ${count}, ${countOverdue(overdue)}.` : `${subject} ${count}.`;
}
