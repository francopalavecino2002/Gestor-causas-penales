import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/features/auth/me-query";
import { useFirmMembers } from "@/features/members/member-queries";
import {
  NOTES_MAX,
  TITLE_MAX,
  taskDataOf,
  taskFormSchema,
  taskFormValues,
  taskProblem,
  type TaskFormField,
  type TaskFormValues,
} from "@/features/tasks/task-form-schema";
import { useCreateTask, useUpdateTask } from "@/features/tasks/task-queries";
import type { TaskView } from "@/features/tasks/task-types";

/** Where a new task belongs: a case, or a hearing (its case is the hearing's). */
export interface TaskLinks {
  caseId?: string;
  hearingId?: string;
  /** Says what it is linked to, e.g. "Para la causa Modelo, Carla s/ ...". */
  context?: string;
}

/**
 * "Nueva tarea": a short form (what, when, who; notes optional) that opens from the tasks
 * screen, a case or a hearing. The responsible starts as the user. With `task`, edits it.
 */
export function TaskFormDialog({
  task,
  links = {},
  defaultResponsible,
  onClose,
}: {
  task?: TaskView;
  links?: TaskLinks;
  /** Who starts as responsible on a new task; the user by default. */
  defaultResponsible?: string;
  onClose: () => void;
}) {
  const formId = useId();
  const { data: me } = useMe();
  const members = useFirmMembers();
  const create = useCreateTask();
  const update = useUpdateTask(task?.id ?? "");
  const [general, setGeneral] = useState<string | null>(null);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: taskFormValues(task, defaultResponsible ?? me?.id ?? ""),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  // A responsible who left the firm is not among the active members: keep them as an option.
  // Any member can be responsible for a task, whatever their role: only id and name matter here.
  const options: { id: string; displayName: string }[] = (members.data ?? [])
    .map(({ id, displayName }) => ({ id, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es-AR"));
  if (task && !options.some((member) => member.id === task.responsible.id)) {
    options.unshift(task.responsible);
  }

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    const data = taskDataOf(values, {
      caseId: task ? (task.caseRef?.id ?? null) : (links.caseId ?? null),
      hearingId: task ? (task.hearing?.id ?? null) : (links.hearingId ?? null),
    });
    try {
      if (task) await update.mutateAsync(data);
      else await create.mutateAsync(data);
      onClose();
    } catch (error) {
      const problem = taskProblem(error);
      let first = true;
      for (const [field, message] of Object.entries(problem.fields)) {
        if (!message) continue;
        setError(field as TaskFormField, { message }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
    }
  });

  const ids = {
    title: `${formId}-title`,
    due: `${formId}-due`,
    responsible: `${formId}-responsible`,
    notes: `${formId}-notes`,
  };
  const ready = !members.isPending;
  const context = task ? editContext(task) : links.context;

  return (
    <FormSheet
      title={task ? "Editá la tarea" : "Nueva tarea"}
      description={context}
      onClose={onClose}
      busy={!ready}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelá
          </Button>
          <Button type="submit" form={formId} disabled={!ready || isSubmitting}>
            {isSubmitting && (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            Guardá la tarea
          </Button>
        </>
      }
    >
      {!ready ? (
        <FormSkeleton />
      ) : (
        <form id={formId} noValidate onSubmit={submit} className="grid gap-5">
          {general && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{general}</AlertDescription>
            </Alert>
          )}
          <Field>
            <Label htmlFor={ids.title}>Qué hay que hacer</Label>
            <Input
              id={ids.title}
              autoComplete="off"
              maxLength={TITLE_MAX}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? `${ids.title}-error` : undefined}
              {...register("title")}
            />
            <FieldError id={`${ids.title}-error`}>{errors.title?.message}</FieldError>
          </Field>
          {/* items-start: the date's help line must not stretch the responsible's field. */}
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field>
              <Label htmlFor={ids.due}>Vence el</Label>
              <Input
                id={ids.due}
                type="date"
                className="tabular-nums"
                aria-invalid={errors.dueDate ? true : undefined}
                aria-describedby={`${ids.due}-help${errors.dueDate ? ` ${ids.due}-error` : ""}`}
                {...register("dueDate")}
              />
              <FieldDescription id={`${ids.due}-help`}>Opcional.</FieldDescription>
              <FieldError id={`${ids.due}-error`}>{errors.dueDate?.message}</FieldError>
            </Field>
            <Field>
              <Label htmlFor={ids.responsible}>Quién la hace</Label>
              <Select
                id={ids.responsible}
                aria-invalid={errors.responsibleUserId ? true : undefined}
                aria-describedby={
                  errors.responsibleUserId || members.isError
                    ? `${ids.responsible}-error`
                    : undefined
                }
                {...register("responsibleUserId")}
              >
                {options.length === 0 && <option value="">Sin personas para elegir</option>}
                {options.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.id === me?.id ? `${member.displayName} (vos)` : member.displayName}
                  </option>
                ))}
              </Select>
              <FieldError id={`${ids.responsible}-error`}>
                {errors.responsibleUserId?.message ??
                  (members.isError
                    ? "No pudimos cargar a las personas del estudio. Cerrá y volvé a abrir el formulario."
                    : undefined)}
              </FieldError>
            </Field>
          </div>
          <Field>
            <Label htmlFor={ids.notes}>Notas</Label>
            <Textarea
              id={ids.notes}
              rows={3}
              maxLength={NOTES_MAX}
              className="min-h-24"
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={`${ids.notes}-help${errors.notes ? ` ${ids.notes}-error` : ""}`}
              {...register("notes")}
            />
            <FieldDescription id={`${ids.notes}-help`}>
              Opcional. Lo que haga falta para hacerla sin preguntar.
            </FieldDescription>
            <FieldError id={`${ids.notes}-error`}>{errors.notes?.message}</FieldError>
          </Field>
        </form>
      )}
    </FormSheet>
  );
}

function editContext(task: TaskView): string | undefined {
  if (task.hearing) return `De la audiencia ${task.hearing.typeName}.`;
  if (task.caseRef) return `De la causa ${task.caseRef.caption}.`;
  return undefined;
}
