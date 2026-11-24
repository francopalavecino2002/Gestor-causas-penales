import type { IsoDate } from "@/features/agenda/agenda-types";
import { TaskList } from "@/features/tasks/task-list";

/**
 * The case's pending tasks, whoever does them, with the same cards as `/tareas` (the case link
 * left out: it is this one). Hearing tasks show here too, since a hearing's case is the case.
 */
export function CaseTasks({
  caseId,
  today,
  timeZone,
}: {
  caseId: string;
  today: IsoDate;
  timeZone: string;
}) {
  return (
    <TaskList
      filter={{ caseId, status: "PENDING" }}
      today={today}
      timeZone={timeZone}
      headingLevel="h3"
      showCase={false}
      loadingLabel="Cargando las tareas de la causa"
      errorTitle="No pudimos cargar las tareas de la causa"
      empty={
        <p className="text-body text-muted-foreground">
          Esta causa no tiene tareas pendientes. Anotá lo que haya que hacer, con fecha y
          responsable, y lo vas a ver acá y en Tareas.
        </p>
      }
    />
  );
}
