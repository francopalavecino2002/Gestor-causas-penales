import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarX2, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { IsoDate } from "@/features/agenda/agenda-types";
import { useTaskActions } from "@/features/tasks/task-actions";
import { countTasks } from "@/features/tasks/task-format";
import { CheckboxHint, TASK_LINK_CLASS, TaskCheckbox } from "@/features/tasks/task-item";
import { TaskNoticeBar } from "@/features/tasks/task-list";
import { useTaskCount, useTaskPreview } from "@/features/tasks/task-queries";
import type { TaskView } from "@/features/tasks/task-types";
import { cn } from "@/lib/utils";

/** How many of today's tasks the card lists. */
const VISIBLE = 3;

/** On phones (below `md`) only the first: the day's hearings come right after the card. */
const VISIBLE_ON_PHONES = 1;

function TodayTask({
  task,
  onToggle,
  className,
}: {
  task: TaskView;
  onToggle: (task: TaskView, done: boolean) => void;
  className?: string;
}) {
  const titleId = useId();
  return (
    <li className={cn("flex min-h-11 items-start gap-3 py-1", className)}>
      <TaskCheckbox task={task} titleId={titleId} onToggle={onToggle} className="mt-0.5" />
      <CheckboxHint task={task} titleId={titleId} />
      <div className="grid min-w-0">
        <span
          id={titleId}
          className={cn(
            "font-semibold break-words",
            task.status === "DONE" && "text-muted-foreground line-through decoration-1",
          )}
        >
          {task.title}
        </span>
        {task.caseRef && (
          <Link
            to="/causas/$caseId"
            params={{ caseId: task.caseRef.id }}
            className="justify-self-start text-meta text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            {task.caseRef.caption}
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * The agenda home's "Tareas de hoy": the user's pending tasks due today, how many are overdue,
 * and a way to Tareas. Tasks can be marked done right here.
 */
export function TodayTasksCard({ today, className }: { today: IsoDate; className?: string }) {
  const titleId = useId();
  const preview = useTaskPreview({ scope: "mine", dueOn: today, status: "PENDING" }, VISIBLE);
  const overdue = useTaskCount({ scope: "mine", overdue: true });
  const actions = useTaskActions();

  const tasks = preview.data?.items ?? [];
  const total = preview.data?.total ?? 0;
  const late = overdue.data ?? 0;

  let body;
  if (preview.isPending) {
    body = (
      <div
        role="status"
        aria-busy="true"
        aria-label="Cargando tus tareas de hoy"
        className="grid gap-2"
      >
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
    );
  } else if (preview.isError) {
    body = (
      <div role="alert" className="grid justify-items-start gap-1">
        <p className="text-meta">No pudimos cargar tus tareas de hoy.</p>
        <Button variant="outline" onClick={() => void preview.refetch()}>
          Volvé a intentar
        </Button>
      </div>
    );
  } else if (tasks.length === 0) {
    body = <p className="text-meta text-muted-foreground">No tenés tareas que venzan hoy.</p>;
  } else {
    body = (
      <ul aria-label="Tareas que vencen hoy" className="grid gap-1">
        {tasks.map((task, index) => (
          <TodayTask
            key={task.id}
            task={task}
            onToggle={actions.toggle}
            className={index >= VISIBLE_ON_PHONES ? "max-md:hidden" : undefined}
          />
        ))}
      </ul>
    );
  }

  return (
    <Card asChild className={cn("gap-3", className)}>
      <section aria-labelledby={titleId}>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <h2 id={titleId} className="flex items-center gap-2 text-title font-bold">
            <ListChecks aria-hidden="true" className="size-5.5 text-primary" />
            Tareas de hoy
          </h2>
          {preview.isSuccess && total > 0 && (
            <span className="text-meta text-muted-foreground tabular-nums">
              {countTasks(total)}
            </span>
          )}
        </div>
        {body}
        <TaskNoticeBar actions={actions} />
        {late > 0 && (
          <p className="flex items-center gap-2 text-meta font-semibold text-deadline">
            <CalendarX2 aria-hidden="true" className="size-5 shrink-0" />
            {late === 1 ? "Tenés 1 tarea vencida." : `Tenés ${late} tareas vencidas.`}
          </p>
        )}
        <Link
          to="/tareas"
          className={cn(
            TASK_LINK_CLASS,
            "-my-1 inline-flex min-h-11 items-center justify-self-start text-meta font-semibold",
          )}
        >
          Mirá todas tus tareas
        </Link>
      </section>
    </Card>
  );
}
