import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { IsoDate } from "@/features/agenda/agenda-types";
import { useMe } from "@/features/auth/me-query";
import { LoadError } from "@/features/cases/case-states";
import { useTaskActions, type TaskNotice } from "@/features/tasks/task-actions";
import { TaskFormDialog } from "@/features/tasks/task-form-dialog";
import { canManageTask } from "@/features/tasks/task-format";
import { TaskItem } from "@/features/tasks/task-item";
import { useTaskList } from "@/features/tasks/task-queries";
import type { TaskFilter, TaskView } from "@/features/tasks/task-types";
import { cn } from "@/lib/utils";

const NOTICE_TEXT: Record<Exclude<TaskNotice["kind"], "error">, string> = {
  done: "quedó hecha",
  reopened: "volvió a pendiente",
  archived: "quedó archivada",
  restored: "volvió a la lista",
};

/**
 * Says what the last action did, with "Deshacé". A polite live region, so a screen reader hears
 * it without losing its place; errors are announced at once. Focusable from code (`ref`): when
 * the task leaves the list, the focus lands here instead of on the page's body.
 */
export function TaskNoticeBar({
  actions,
}: {
  actions: Pick<ReturnType<typeof useTaskActions>, "notice" | "noticeRef" | "undo" | "dismiss">;
}) {
  const { notice, noticeRef, undo: onUndo, dismiss: onDismiss } = actions;
  return (
    <div ref={noticeRef} tabIndex={-1} aria-live="polite" className="rounded-lg empty:hidden">
      {notice?.kind === "error" ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-meta font-semibold text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span className="flex-1">{notice.message}</span>
        </p>
      ) : notice ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card py-1 pr-1 pl-4 text-meta">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-status-efectiva" />
          <p className="min-w-0 flex-1 py-2">
            «{notice.task.title}» {NOTICE_TEXT[notice.kind]}.
          </p>
          <div className="flex">
            <Button variant="ghost" className="px-3 text-primary" onClick={onUndo}>
              Deshacé
            </Button>
            <Button variant="ghost" className="px-3" onClick={onDismiss}>
              Cerrá
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TasksSkeleton({ count = 3, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex gap-3.5 rounded-xl border bg-card px-4 pt-3.5 pb-4">
          <Skeleton className="mt-1 size-5.5 rounded-sm" />
          <div className="grid flex-1 gap-2.5">
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A list of tasks with everything a task offers (done, edit, archive), the undo notice and
 * "Mirá más tareas". The screen decides what to show when there are none.
 */
export function TaskList({
  filter,
  today,
  timeZone,
  empty,
  loadingLabel,
  errorTitle,
  headingLevel = "h2",
  showResponsible = true,
  showCase = true,
  keepPreviousWhileLoading = false,
}: {
  filter: TaskFilter;
  /**
   * Keep the current tasks (dimmed) while another filter of the same screen loads, e.g. the
   * switches of /tareas. Off by default: another case's tasks must never show for this one.
   */
  keepPreviousWhileLoading?: boolean;
  today: IsoDate;
  timeZone: string;
  empty: ReactNode;
  loadingLabel: string;
  errorTitle: string;
  headingLevel?: "h2" | "h3" | "h4";
  showResponsible?: boolean;
  showCase?: boolean;
}) {
  const { data: me } = useMe();
  const list = useTaskList(filter, { keepPrevious: keepPreviousWhileLoading });
  const actions = useTaskActions();
  const [editing, setEditing] = useState<TaskView | null>(null);

  const notice = <TaskNoticeBar actions={actions} />;

  if (list.isPending) return <TasksSkeleton label={loadingLabel} />;
  if (list.isError) {
    return <LoadError title={errorTitle} error={list.error} onRetry={() => void list.refetch()} />;
  }

  const tasks = list.data.pages.flatMap((page) => page.items);
  const total = list.data.pages[0]?.total ?? 0;

  return (
    <div className="grid gap-3">
      {notice}
      {tasks.length === 0 ? (
        empty
      ) : (
        <ul
          aria-busy={list.isPlaceholderData}
          className={cn(
            "grid gap-3 transition-opacity duration-fast ease-out",
            list.isPlaceholderData && "opacity-60",
          )}
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskItem
                task={task}
                today={today}
                timeZone={timeZone}
                headingLevel={headingLevel}
                showResponsible={showResponsible}
                showCase={showCase}
                canManage={canManageTask(me, task)}
                onToggle={actions.toggle}
                onEdit={setEditing}
                onArchive={(task) => actions.archive(task)}
              />
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="outline"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            {list.isFetchingNextPage && (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            Mirá más tareas
          </Button>
          <p className="text-small text-muted-foreground tabular-nums">
            Ves {tasks.length} de {total}.
          </p>
        </div>
      )}
      {editing && <TaskFormDialog task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
