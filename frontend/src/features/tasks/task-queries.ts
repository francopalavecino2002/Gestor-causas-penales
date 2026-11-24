import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import {
  createTask,
  fetchTasks,
  setTaskArchived,
  setTaskDone,
  updateTask,
} from "@/features/tasks/task-api";
import type { TaskData, TaskFilter, TaskPage, TaskView } from "@/features/tasks/task-types";

const TASKS_KEY = "tasks";

/** Tasks per "Mirá más": enough for a busy week, small enough for a phone. */
export const TASK_PAGE_SIZE = 20;

/**
 * A list that grows with "Mirá más tareas". With `keepPrevious`, the previous filter's tasks stay
 * on screen while the next one loads (only for filters of the same screen).
 */
export function useTaskList(filter: TaskFilter, options: { keepPrevious?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: [TASKS_KEY, "list", filter] as const,
    queryFn: ({ pageParam, signal }) => fetchTasks(filter, pageParam, TASK_PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (last: TaskPage) =>
      (last.page + 1) * last.size < last.total ? last.page + 1 : undefined,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

/** Only how many tasks match (one item fetched): for summaries such as "2 vencidas". */
export function useTaskCount(filter: TaskFilter) {
  return useQuery({
    queryKey: [TASKS_KEY, "count", filter] as const,
    queryFn: ({ signal }) => fetchTasks(filter, 0, 1, signal),
    select: (page) => page.total,
  });
}

/** A short first page, e.g. the home card's tasks for today. */
export function useTaskPreview(filter: TaskFilter, size: number) {
  return useQuery({
    queryKey: [TASKS_KEY, "preview", filter, size] as const,
    queryFn: ({ signal }) => fetchTasks(filter, 0, size, signal),
  });
}

function invalidateTasks(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
}

/** Replaces one task wherever a list or a preview holds it. */
function patchTask(queryClient: QueryClient, taskId: string, patch: (task: TaskView) => TaskView) {
  const patchPage = (page: TaskPage): TaskPage => ({
    ...page,
    items: page.items.map((task) => (task.id === taskId ? patch(task) : task)),
  });
  // Every task query caches pages: the counts select their total only when read.
  queryClient.setQueriesData<InfiniteData<TaskPage> | TaskPage>(
    { queryKey: [TASKS_KEY] },
    (data) => {
      if (data === undefined) return data;
      if ("pages" in data) return { ...data, pages: data.pages.map(patchPage) };
      return patchPage(data);
    },
  );
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskData) => createTask(data),
    onSuccess: () => invalidateTasks(queryClient),
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskData) => updateTask(taskId, data),
    onSuccess: () => invalidateTasks(queryClient),
  });
}

/**
 * Marks a task done or pending again. The checkbox changes at once (optimistic); on failure the
 * task goes back to how it was and the error is left for the screen to explain.
 */
export function useSetTaskDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { task: TaskView; done: boolean }) =>
      setTaskDone(variables.task.id, variables.done),
    onMutate: async ({ task, done }) => {
      await queryClient.cancelQueries({ queryKey: [TASKS_KEY] });
      patchTask(queryClient, task.id, (current) => ({
        ...current,
        status: done ? "DONE" : "PENDING",
        overdue: done ? false : current.overdue,
      }));
    },
    onError: (_error, { task }) => patchTask(queryClient, task.id, () => task),
    onSettled: () => invalidateTasks(queryClient),
  });
}

/** Archives a task (it leaves the lists) or restores it. */
export function useSetTaskArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { task: TaskView; archived: boolean }) =>
      setTaskArchived(variables.task.id, variables.archived),
    onSettled: () => invalidateTasks(queryClient),
  });
}
