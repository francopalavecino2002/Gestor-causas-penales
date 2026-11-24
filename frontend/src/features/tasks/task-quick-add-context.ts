import { createContext, useContext } from "react";

import type { TaskLinks } from "@/features/tasks/task-form-dialog";

/**
 * Opens "Nueva tarea" linked to something on screen (a hearing). Provided by the screens that own
 * the form (the agenda, a case), so the hearing cards deep in the page can offer "Sumá una tarea"
 * without passing a callback down. Null where tasks cannot be added.
 */
export const TaskQuickAddContext = createContext<((links: TaskLinks) => void) | null>(null);

export function useTaskQuickAdd() {
  return useContext(TaskQuickAddContext);
}
