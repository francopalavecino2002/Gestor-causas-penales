import { z } from "zod";

import { isIsoDate } from "@/features/agenda/agenda-dates";
import type { TaskData, TaskView } from "@/features/tasks/task-types";
import { formProblem, type FormProblem } from "@/lib/form-errors";

/** Same limits as the backend (`TaskData`). */
export const TITLE_MAX = 200;
export const NOTES_MAX = 2000;

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribí qué hay que hacer.")
    .max(TITLE_MAX, `Usá hasta ${TITLE_MAX} caracteres.`),
  dueDate: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Elegí una fecha válida o dejala vacía."),
  responsibleUserId: z.string().min(1, "Elegí quién la hace."),
  notes: z.string().trim().max(NOTES_MAX, `Usá hasta ${NOTES_MAX} caracteres.`),
});

export type TaskFormValues = z.output<typeof taskFormSchema>;
export type TaskFormField = keyof TaskFormValues;

const FIELDS: readonly TaskFormField[] = ["title", "dueDate", "responsibleUserId", "notes"];

export function taskFormValues(task: TaskView | undefined, responsibleId: string): TaskFormValues {
  return {
    title: task?.title ?? "",
    dueDate: task?.dueDate ?? "",
    responsibleUserId: task?.responsible.id ?? responsibleId,
    notes: task?.notes ?? "",
  };
}

/** The body of the save; the links (case, hearing) come from where the form was opened. */
export function taskDataOf(
  values: TaskFormValues,
  links: { caseId: string | null; hearingId: string | null },
): TaskData {
  return {
    title: values.title,
    notes: values.notes === "" ? null : values.notes,
    dueDate: values.dueDate === "" ? null : values.dueDate,
    responsibleUserId: values.responsibleUserId,
    caseId: links.caseId,
    hearingId: links.hearingId,
  };
}

/** A failed save, in the form's words. */
export function taskProblem(error: unknown): FormProblem<TaskFormField> {
  return formProblem(error, {
    subject: "la tarea",
    fields: FIELDS,
    rules: [
      {
        type: "invalid-task-data",
        detail: /responsible/i,
        field: "responsibleUserId",
        message: "Esa persona ya no está activa en el estudio. Elegí a otra.",
      },
      {
        type: "archived-record",
        detail: /task/i,
        message: "La tarea está archivada: para cambiarla, primero hay que restaurarla.",
      },
      {
        type: "archived-record",
        message:
          "La causa o la audiencia está archivada, así que no se le pueden sumar tareas. Restaurala primero o guardá la tarea sin vincularla.",
      },
      {
        type: "access-denied",
        message:
          "No podés editar esta tarea: la editan quien la creó, quien es responsable y los abogados del estudio. Igual podés marcarla como hecha.",
      },
      {
        type: "not-found",
        message:
          "Ya no encontramos la tarea, la causa o la audiencia (puede que la hayan archivado o reservado). Recargá la página y volvé a intentar.",
      },
    ],
  });
}
