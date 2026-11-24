import { describe, expect, it } from "vitest";

import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import { canManageTask, dueText, tasksSummary } from "@/features/tasks/task-format";
import type { TaskView } from "@/features/tasks/task-types";
import { TASK_HUGO_NOTICE, TASK_WEEK_REVIEW } from "@/test/task-fixtures";

const pending = (dueDate: string | null): TaskView => ({ ...TASK_WEEK_REVIEW, dueDate });

describe("dueText", () => {
  it("says hoy and mañana, also across the end of the month", () => {
    expect(dueText(pending("2026-11-30"), "2026-11-30", FIRM_TIME_ZONE)).toBe("Vence hoy");
    expect(dueText(pending("2026-12-01"), "2026-11-30", FIRM_TIME_ZONE)).toBe("Vence mañana");
    expect(dueText(pending("2027-01-01"), "2026-12-31", FIRM_TIME_ZONE)).toBe("Vence mañana");
  });

  it("names the day of a later or past due day", () => {
    expect(dueText(pending("2026-12-02"), "2026-11-30", FIRM_TIME_ZONE)).toBe(
      "Vence el miércoles 2/12",
    );
    expect(dueText(pending("2026-11-29"), "2026-11-30", FIRM_TIME_ZONE)).toBe(
      "Venció el domingo 29/11",
    );
  });

  it("says when there is no due day", () => {
    expect(dueText(pending(null), "2026-11-30", FIRM_TIME_ZONE)).toBe("Sin fecha");
  });

  it("says when a done task was done, in the firm's zone", () => {
    const done: TaskView = {
      ...pending("2026-11-20"),
      status: "DONE",
      // 01:30 UTC on the 24th is still the 23rd in Neuquén.
      doneAt: "2026-11-24T01:30:00Z",
    };
    expect(dueText(done, "2026-11-30", FIRM_TIME_ZONE)).toBe("Hecha el lunes 23/11");
    expect(dueText({ ...done, doneAt: null }, "2026-11-30", FIRM_TIME_ZONE)).toBe("Hecha");
  });
});

describe("tasksSummary", () => {
  it("counts the user's own tasks in singular and plural", () => {
    expect(tasksSummary({ pending: 0, overdue: 0 })).toBe("No tenés tareas pendientes.");
    expect(tasksSummary({ pending: 1, overdue: 0 })).toBe("Tenés 1 tarea pendiente.");
    expect(tasksSummary({ pending: 1, overdue: 1 })).toBe("Tenés 1 tarea pendiente, 1 vencida.");
    expect(tasksSummary({ pending: 5, overdue: 2 })).toBe("Tenés 5 tareas pendientes, 2 vencidas.");
  });

  it("talks about someone else in third person", () => {
    expect(tasksSummary({ pending: 0, overdue: 0, personName: "Paula Demo" })).toBe(
      "Paula Demo no tiene tareas pendientes.",
    );
    expect(tasksSummary({ pending: 3, overdue: 0, personName: "Paula Demo" })).toBe(
      "Paula Demo tiene 3 tareas pendientes.",
    );
  });
});

describe("canManageTask", () => {
  const paralegal = { id: "00000000-0000-4000-8000-000000000004", role: "PARALEGAL" as const };

  it("lets owners and lawyers manage any task", () => {
    expect(canManageTask({ ...paralegal, role: "OWNER" }, TASK_HUGO_NOTICE)).toBe(true);
    expect(canManageTask({ ...paralegal, role: "LAWYER" }, TASK_HUGO_NOTICE)).toBe(true);
  });

  it("lets other roles manage only the tasks they created or are responsible for", () => {
    expect(canManageTask(paralegal, TASK_HUGO_NOTICE)).toBe(false);
    expect(canManageTask(paralegal, { ...TASK_HUGO_NOTICE, createdBy: paralegal.id })).toBe(true);
    expect(
      canManageTask(paralegal, {
        ...TASK_HUGO_NOTICE,
        responsible: { id: paralegal.id, displayName: "Tomás Muestra" },
      }),
    ).toBe(true);
    expect(canManageTask(undefined, TASK_HUGO_NOTICE)).toBe(false);
  });
});
