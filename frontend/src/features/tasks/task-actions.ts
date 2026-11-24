import { useEffect, useRef, useState } from "react";

import { isApiError, NETWORK_ERROR } from "@/lib/api";
import { useSetTaskArchived, useSetTaskDone } from "@/features/tasks/task-queries";
import type { TaskView } from "@/features/tasks/task-types";

/** What the last action did, with a way back; or what went wrong. */
export type TaskNotice =
  | { kind: "done" | "reopened" | "archived" | "restored"; task: TaskView }
  | { kind: "error"; message: string };

function actionError(error: unknown, what: string): string {
  if (isApiError(error)) {
    if (error.type === NETWORK_ERROR) {
      return `No hay conexión con el servidor, así que no se ${what}. Revisá tu conexión y volvé a intentar.`;
    }
    if (error.status === 403) {
      return "No podés hacer esto con esta tarea: la editan y archivan quien la creó, quien es responsable y los abogados del estudio.";
    }
    if (error.status === 404) {
      return "Ya no encontramos esa tarea. Puede que la hayan archivado: recargá la página.";
    }
    if (error.type === "archived-record") {
      return "Esa tarea está archivada: restaurala para cambiarla.";
    }
  }
  return `El servidor no respondió como esperábamos y no se ${what}. Volvé a intentar en unos minutos.`;
}

/**
 * Done / pending and archive / restore for a list of tasks, with one notice that says what
 * happened and offers to undo it ("Deshacé"), so a slip of the thumb costs nothing.
 *
 * Each action awaits its own request (`mutateAsync`), so several quick ticks each get their
 * notice or error. After a change the task often leaves the list and its checkbox with it: the
 * focus then moves to the notice (`noticeRef`), unless the user already went somewhere else.
 */
export function useTaskActions() {
  const setDone = useSetTaskDone();
  const setArchived = useSetTaskArchived();
  const [notice, setNotice] = useState<TaskNotice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  /** The element the last action started from, while its notice is due. */
  const origin = useRef<Element | null>(null);

  useEffect(() => {
    if (!notice || notice.kind === "error" || !origin.current) return;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || active === origin.current;
    origin.current = null;
    if (focusLost) noticeRef.current?.focus();
  }, [notice]);

  const run = async (action: () => Promise<unknown>, success: TaskNotice, failure: string) => {
    origin.current = document.activeElement;
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (error) {
      origin.current = null;
      setNotice({ kind: "error", message: actionError(error, failure) });
    }
  };

  const toggle = (task: TaskView, done: boolean) =>
    void run(
      () => setDone.mutateAsync({ task, done }),
      { kind: done ? "done" : "reopened", task },
      "guardó el cambio",
    );

  const archive = (task: TaskView, archived = true) =>
    void run(
      () => setArchived.mutateAsync({ task, archived }),
      { kind: archived ? "archived" : "restored", task },
      archived ? "archivó la tarea" : "restauró la tarea",
    );

  /** Reverts the action the notice talks about. */
  const undo = () => {
    if (!notice || notice.kind === "error") return;
    const { task } = notice;
    if (notice.kind === "done") toggle({ ...task, status: "DONE" }, false);
    else if (notice.kind === "reopened") toggle({ ...task, status: "PENDING" }, true);
    else archive(task, notice.kind === "restored");
  };

  return { notice, noticeRef, toggle, archive, undo, dismiss: () => setNotice(null) };
}
