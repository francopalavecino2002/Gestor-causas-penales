import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  FileText,
  NotebookText,
  Pencil,
  User,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatShortDayLabel, formatTime, localDay } from "@/features/agenda/agenda-dates";
import type { IsoDate } from "@/features/agenda/agenda-types";
import { dueText } from "@/features/tasks/task-format";
import type { TaskView } from "@/features/tasks/task-types";
import { cn } from "@/lib/utils";

/**
 * The checkbox that marks a task done or pending again. Its name is the task, its state says
 * whether it is done: "Presentar el escrito, casilla, marcada".
 */
export function TaskCheckbox({
  task,
  titleId,
  onToggle,
  className,
}: {
  task: TaskView;
  titleId: string;
  onToggle: (task: TaskView, done: boolean) => void;
  className?: string;
}) {
  return (
    <Checkbox
      checked={task.status === "DONE"}
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-hint`}
      onCheckedChange={(checked) => onToggle(task, checked === true)}
      className={className}
    />
  );
}

/**
 * "Marcala como hecha" / "Hecha": what the checkbox does, for screen readers. Render it next to
 * every <TaskCheckbox> with the same `titleId`: the checkbox points at it.
 */
export function CheckboxHint({ task, titleId }: { task: TaskView; titleId: string }) {
  return (
    <span id={`${titleId}-hint`} className="sr-only">
      {task.status === "DONE" ? "Hecha. Desmarcala para dejarla pendiente." : "Marcala como hecha."}
    </span>
  );
}

/** "Vencida" in words, with its icon and the deadline tone (amber means a deadline). */
export function OverdueBadge() {
  return (
    <Badge variant="deadline">
      <CalendarX2 aria-hidden="true" />
      Vencida
    </Badge>
  );
}

/** The due day, emphasized when it is today or already past. */
export function DueLine({
  task,
  today,
  timeZone,
}: {
  task: TaskView;
  today: IsoDate;
  timeZone: string;
}) {
  const urgent = task.status === "PENDING" && task.dueDate !== null && task.dueDate <= today;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums",
        urgent ? "font-semibold text-deadline" : "text-muted-foreground",
      )}
    >
      <CalendarDays aria-hidden="true" className="size-4.5 shrink-0" />
      {task.dueDate && task.status === "PENDING" ? (
        <time dateTime={task.dueDate}>{dueText(task, today, timeZone)}</time>
      ) : (
        dueText(task, today, timeZone)
      )}
    </span>
  );
}

interface MetaRow {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
}

/** A link in task text (case, hearing, "Mirá todas tus tareas"): primary, underlined. */
export const TASK_LINK_CLASS = "text-primary underline underline-offset-4 hover:decoration-2";

function metaRows(task: TaskView, timeZone: string, showResponsible: boolean, showCase: boolean) {
  const rows: MetaRow[] = [];
  if (showResponsible) {
    rows.push({ icon: User, term: "Responsable", value: task.responsible.displayName });
  }
  if (task.caseRef && showCase) {
    rows.push({
      icon: FileText,
      term: "Causa",
      value: (
        <Link to="/causas/$caseId" params={{ caseId: task.caseRef.id }} className={TASK_LINK_CLASS}>
          {task.caseRef.caption}
        </Link>
      ),
    });
  }
  if (task.hearing) {
    const day = localDay(task.hearing.startsAt, timeZone);
    rows.push({
      icon: CalendarClock,
      term: "Audiencia",
      value: (
        <Link to="/" search={{ fecha: day }} className={TASK_LINK_CLASS}>
          {task.hearing.typeName},{" "}
          <time dateTime={task.hearing.startsAt} className="tabular-nums">
            {formatShortDayLabel(day)} {formatTime(task.hearing.startsAt, timeZone)}
          </time>
        </Link>
      ),
    });
  }
  if (task.notes?.trim()) {
    rows.push({ icon: NotebookText, term: "Notas", value: task.notes.trim() });
  }
  return rows;
}

/**
 * One task: the checkbox, what to do, when it is due ("Vencida" with an amber edge when it is
 * late), who does it, the case and hearing it belongs to, and Editá / Archivá for those who can.
 */
export function TaskItem({
  task,
  today,
  timeZone,
  headingLevel = "h2",
  showResponsible = true,
  showCase = true,
  canManage,
  onToggle,
  onEdit,
  onArchive,
}: {
  task: TaskView;
  today: IsoDate;
  timeZone: string;
  headingLevel?: "h2" | "h3" | "h4";
  showResponsible?: boolean;
  /** False inside the case itself. */
  showCase?: boolean;
  canManage: boolean;
  onToggle: (task: TaskView, done: boolean) => void;
  onEdit: (task: TaskView) => void;
  onArchive: (task: TaskView) => void;
}) {
  const titleId = useId();
  const Heading = headingLevel;
  const done = task.status === "DONE";
  const rows = metaRows(task, timeZone, showResponsible, showCase);
  return (
    <Card edge={task.overdue ? "deadline" : "none"} asChild>
      <article aria-labelledby={titleId} data-task-id={task.id}>
        <div className="flex items-start gap-3.5">
          <TaskCheckbox task={task} titleId={titleId} onToggle={onToggle} className="mt-1" />
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="grid gap-1">
              <Heading
                id={titleId}
                className={cn(
                  "text-card-title font-bold text-pretty break-words",
                  done && "font-semibold text-muted-foreground line-through decoration-1",
                )}
              >
                {task.title}
              </Heading>
              <CheckboxHint task={task} titleId={titleId} />
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-meta">
                {task.overdue && <OverdueBadge />}
                <DueLine task={task} today={today} timeZone={timeZone} />
              </p>
            </div>
            {rows.length > 0 && (
              <dl className="grid gap-1 text-meta">
                {rows.map(({ icon: Icon, term, value }) => (
                  <div key={term} className="flex min-w-0 items-start gap-2">
                    <dt className="sr-only">{term}</dt>
                    <Icon
                      aria-hidden="true"
                      className="mt-0.75 size-4.5 shrink-0 text-muted-foreground"
                    />
                    <dd className="min-w-0 break-words whitespace-pre-line">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {canManage && (
              <div className="-mx-2 -mb-2 flex flex-wrap items-center gap-x-1">
                <Button
                  variant="ghost"
                  className="px-2 text-primary"
                  aria-label={`Editá la tarea ${task.title}`}
                  onClick={() => onEdit(task)}
                >
                  <Pencil aria-hidden="true" />
                  Editá
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 text-primary"
                  aria-label={`Archivá la tarea ${task.title}`}
                  onClick={() => onArchive(task)}
                >
                  <Archive aria-hidden="true" />
                  Archivá
                </Button>
              </div>
            )}
          </div>
        </div>
      </article>
    </Card>
  );
}
