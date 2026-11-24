import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agendaFor, FIXTURE_NOW, LAWYER_PAULA, WEEK_HEARINGS } from "@/test/agenda-fixtures";
import { CASE_MODELO, DETAIL_MODELO } from "@/test/case-fixtures";
import {
  caseRoutes,
  DEMO_ME,
  json,
  problemWith,
  signedIn,
  taskRoutes,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { TASK_LEGAJO_COPY, TASK_REVIEW_BRIEF, TASK_WEEK_REVIEW } from "@/test/task-fixtures";

const created = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method === "POST" && request.path === "/api/v1/tasks");

/** The page offers "Nueva tarea" twice (header and floating button): either opens the form. */
function newTaskButton(): HTMLElement {
  const [first] = screen.getAllByRole("button", { name: "Nueva tarea" });
  if (!first) throw new Error("No «Nueva tarea» button");
  return first;
}

/** Opens the form and waits for its fields (the members load first). */
async function openForm(button: HTMLElement) {
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog", { name: /Nueva tarea/ });
  await within(dialog).findByLabelText("Qué hay que hacer");
  return dialog;
}

describe("quick-add a task", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a task from Tareas, with me as the responsible by default", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title });

    const dialog = await openForm(newTaskButton());
    const title = within(dialog).getByLabelText("Qué hay que hacer");
    await waitFor(() => expect(title).toHaveFocus());
    expect(within(dialog).getByLabelText("Quién la hace")).toHaveValue(DEMO_ME.id);
    expect(within(dialog).getByRole("option", { name: "Lucía Ejemplo (vos)" })).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "  Sacar turno en el registro  " } });
    fireEvent.change(within(dialog).getByLabelText("Vence el"), {
      target: { value: "2026-11-26" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(created(requests)[0]?.body).toEqual({
      title: "Sacar turno en el registro",
      notes: null,
      dueDate: "2026-11-26",
      responsibleUserId: DEMO_ME.id,
      caseId: null,
      hearingId: null,
    });
    const added = await screen.findByRole("article", { name: "Sacar turno en el registro" });
    expect(added).toHaveTextContent("Vence el jueves 26/11");
  });

  it("asks for what to do before saving", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title });

    const dialog = await openForm(newTaskButton());
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    expect(await within(dialog).findByText("Escribí qué hay que hacer.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Qué hay que hacer")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(created(requests)).toHaveLength(0);
  });

  it("assigns a task to someone else and says so when the server rejects the person", async () => {
    const requests = signedIn(undefined, {
      ...taskRoutes(),
      "POST /api/v1/tasks": () =>
        problemWith(400, "invalid-task-data", {
          detail: "The responsible is not an active member of the firm",
        }),
    });
    renderApp("/tareas");
    await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title });

    const dialog = await openForm(newTaskButton());
    fireEvent.change(within(dialog).getByLabelText("Qué hay que hacer"), {
      target: { value: "Revisar el escrito" },
    });
    fireEvent.change(within(dialog).getByLabelText("Quién la hace"), {
      target: { value: LAWYER_PAULA.id },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    expect(
      await within(dialog).findByText("Esa persona ya no está activa en el estudio. Elegí a otra."),
    ).toBeInTheDocument();
    expect(created(requests)[0]?.body).toMatchObject({ responsibleUserId: LAWYER_PAULA.id });
  });

  it("edits a task in the same form", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    const late = await screen.findByRole("article", { name: TASK_LEGAJO_COPY.title });

    fireEvent.click(within(late).getByRole("button", { name: /Editá la tarea/ }));
    const dialog = await screen.findByRole("dialog", { name: "Editá la tarea" });
    expect(dialog).toHaveTextContent(`De la causa ${CASE_MODELO.caption}.`);
    expect(within(dialog).getByLabelText("Vence el")).toHaveValue("2026-11-20");
    fireEvent.change(within(dialog).getByLabelText("Vence el"), {
      target: { value: "2026-11-24" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const put = requests.find((request) => request.method === "PUT");
    expect(put?.path).toBe(`/api/v1/tasks/${TASK_LEGAJO_COPY.id}`);
    expect(put?.body).toMatchObject({ dueDate: "2026-11-24", caseId: CASE_MODELO.id });
    const moved = await screen.findByRole("article", { name: TASK_LEGAJO_COPY.title });
    await waitFor(() => expect(moved).toHaveTextContent("Vence mañana"));
    expect(within(moved).queryByText("Vencida")).toBeNull();
  });

  it("adds a task from a case and lists the case's tasks there", async () => {
    const requests = signedIn(undefined, { ...caseRoutes(), ...taskRoutes() });
    renderApp(`/causas/${CASE_MODELO.id}`);

    const section = await screen.findByRole("region", { name: "Tareas" });
    expect(
      await within(section).findByRole("article", { name: TASK_LEGAJO_COPY.title }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("article", { name: TASK_REVIEW_BRIEF.title }),
    ).toHaveTextContent("Lucía Ejemplo");
    expect(
      requests.find((request) => request.path === "/api/v1/tasks" && request.query.caseId)?.query,
    ).toMatchObject({ caseId: CASE_MODELO.id, status: "PENDING" });

    const dialog = await openForm(within(section).getByRole("button", { name: "Nueva tarea" }));
    expect(dialog).toHaveTextContent(`Para la causa ${CASE_MODELO.caption}.`);
    fireEvent.change(within(dialog).getByLabelText("Qué hay que hacer"), {
      target: { value: "Pedir el informe del registro" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(created(requests)[0]?.body).toMatchObject({
      title: "Pedir el informe del registro",
      caseId: CASE_MODELO.id,
      hearingId: null,
    });
    expect(
      await within(section).findByRole("article", { name: "Pedir el informe del registro" }),
    ).toBeInTheDocument();
  });

  it("offers no new task in an archived case, but still lists its tasks", async () => {
    signedIn(undefined, {
      ...caseRoutes({ details: [{ ...DETAIL_MODELO, archived: true }] }),
      ...taskRoutes(),
    });
    renderApp(`/causas/${CASE_MODELO.id}`);

    const section = await screen.findByRole("region", { name: "Tareas" });
    expect(
      await within(section).findByRole("article", { name: TASK_LEGAJO_COPY.title }),
    ).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Nueva tarea" })).toBeNull();
    const hearings = screen.getByRole("region", { name: "Audiencias" });
    await within(hearings).findAllByRole("article");
    expect(within(hearings).queryByRole("button", { name: /^Sumá una tarea/ })).toBeNull();
  });

  it("offers a task on a finished hearing only once it is open", async () => {
    signedIn(undefined, {
      ...taskRoutes(),
      "GET /api/v1/agenda": ({ query }) =>
        json(200, agendaFor(WEEK_HEARINGS, query.from ?? "", query.to ?? "")),
    });
    renderApp("/");

    // 08:30, already over at 10:20: collapsed.
    const finished = await screen.findByRole("article", { name: "Formulación de cargos" });
    const name = "Sumá una tarea para la audiencia Formulación de cargos";
    expect(within(finished).queryByRole("button", { name })).toBeNull();

    fireEvent.click(within(finished).getByRole("button", { name: "Mirá el detalle" }));
    expect(within(finished).getByRole("button", { name })).toBeInTheDocument();
  });

  it("adds a task from a hearing of the agenda", async () => {
    const requests = signedIn(undefined, {
      ...taskRoutes(),
      "GET /api/v1/agenda": ({ query }) =>
        json(200, agendaFor(WEEK_HEARINGS, query.from ?? "", query.to ?? "")),
    });
    renderApp("/");

    const button = await screen.findByRole("button", {
      name: "Sumá una tarea para la audiencia Revisión de prisión preventiva",
    });
    const dialog = await openForm(button);
    expect(dialog).toHaveTextContent(
      "Para la audiencia Revisión de prisión preventiva del lunes 23/11 a las 11:00.",
    );
    fireEvent.change(within(dialog).getByLabelText("Qué hay que hacer"), {
      target: { value: "Llevar copia del informe" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la tarea" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(created(requests)[0]?.body).toMatchObject({
      title: "Llevar copia del informe",
      caseId: null,
      hearingId: TASK_REVIEW_BRIEF.hearing?.id,
      responsibleUserId: DEMO_ME.id,
    });
  });
});
