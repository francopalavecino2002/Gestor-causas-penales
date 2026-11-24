import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW, LAWYER_HUGO, LAWYER_PAULA } from "@/test/agenda-fixtures";
import { CASE_MODELO } from "@/test/case-fixtures";
import {
  DEMO_ME,
  json,
  problem,
  signedIn,
  taskRoutes,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import {
  TASK_EVIDENCE_BRIEF,
  TASK_FAMILY_CALL,
  TASK_HUGO_NOTICE,
  TASK_LEGAJO_COPY,
  TASK_NOTICE_PICKUP,
  TASK_REVIEW_BRIEF,
  TASK_WEEK_REVIEW,
} from "@/test/task-fixtures";

const listRequests = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method === "GET" && request.path === "/api/v1/tasks")
    .filter((request) => request.query.size === "20")
    .map((request) => request.query);

const titles = () =>
  screen.getAllByRole("article").map((article) => article.querySelector("h2")?.textContent ?? "");

const card = (name: string) => screen.getByRole("article", { name });

describe("TasksPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists my pending tasks, overdue first, with the day each one is due", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");

    expect(await screen.findByRole("heading", { level: 1, name: "Tareas" })).toBeInTheDocument();
    expect(await screen.findByText("Tenés 4 tareas pendientes, 1 vencida.")).toBeInTheDocument();
    expect(listRequests(requests)[0]).toEqual({
      scope: "mine",
      status: "PENDING",
      page: "0",
      size: "20",
    });

    expect(titles()).toEqual([
      TASK_LEGAJO_COPY.title,
      TASK_REVIEW_BRIEF.title,
      TASK_FAMILY_CALL.title,
      TASK_WEEK_REVIEW.title,
    ]);

    // Overdue: the word and its icon, not only a color.
    const late = card(TASK_LEGAJO_COPY.title);
    expect(within(late).getByText("Vencida")).toBeInTheDocument();
    expect(late).toHaveTextContent("Venció el viernes 20/11");
    expect(within(late).getByRole("link", { name: CASE_MODELO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_MODELO.id}`,
    );

    const review = card(TASK_REVIEW_BRIEF.title);
    expect(within(review).queryByText("Vencida")).not.toBeInTheDocument();
    expect(review).toHaveTextContent("Vence hoy");
    expect(review).toHaveTextContent("Llevar el informe socioambiental ficticio");
    expect(
      within(review).getByRole("link", {
        name: /Revisión de prisión preventiva, lunes 23\/11 11:00/,
      }),
    ).toHaveAttribute("href", "/?fecha=2026-11-23");

    expect(card(TASK_WEEK_REVIEW.title)).toHaveTextContent("Vence el viernes 27/11");
    // "Mías": the responsible is the user, so it is not repeated on every card.
    expect(review).not.toHaveTextContent("Lucía Ejemplo");
    expect(
      within(review).getByRole("checkbox", { name: TASK_REVIEW_BRIEF.title }),
    ).not.toBeChecked();
  });

  it("shows one member's tasks with «Por persona» and keeps the choice in the URL", async () => {
    const requests = signedIn(undefined, taskRoutes());
    const { router } = renderApp("/tareas");
    await screen.findByText("Tenés 4 tareas pendientes, 1 vencida.");

    const who = screen.getByRole("group", { name: "Ver" });
    fireEvent.click(within(who).getByRole("button", { name: "Por persona" }));

    // The first colleague by name: Hugo Prueba.
    await waitFor(() => expect(router.state.location.search).toEqual({ persona: LAWYER_HUGO.id }));
    expect(
      await screen.findByText("Hugo Prueba tiene 1 tarea pendiente, 1 vencida."),
    ).toBeInTheDocument();
    expect(listRequests(requests).at(-1)).toEqual({
      responsible: LAWYER_HUGO.id,
      status: "PENDING",
      page: "0",
      size: "20",
    });
    expect(
      await screen.findByRole("article", { name: TASK_HUGO_NOTICE.title }),
    ).toBeInTheDocument();
    expect(within(who).getByRole("button", { name: "Por persona" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.change(screen.getByLabelText("Persona"), { target: { value: LAWYER_PAULA.id } });
    await waitFor(() => expect(router.state.location.search).toEqual({ persona: LAWYER_PAULA.id }));
    expect(
      await screen.findByRole("article", { name: TASK_EVIDENCE_BRIEF.title }),
    ).toBeInTheDocument();

    fireEvent.click(within(who).getByRole("button", { name: "Mías" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it("adds the done tasks with the switch", async () => {
    const requests = signedIn(undefined, taskRoutes());
    const { router } = renderApp("/tareas");
    await screen.findByRole("article", { name: TASK_REVIEW_BRIEF.title });

    fireEvent.click(screen.getByRole("switch", { name: "Mostrá las hechas" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ hechas: "si" }));
    const done = await screen.findByRole("article", { name: TASK_NOTICE_PICKUP.title });
    expect(done).toHaveTextContent("Hecha el domingo 22/11");
    expect(within(done).getByRole("checkbox")).toBeChecked();
    expect(listRequests(requests).at(-1)).toEqual({ scope: "mine", page: "0", size: "20" });
  });

  it("marks a task done at once and undoes it", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    const review = await screen.findByRole("article", { name: TASK_REVIEW_BRIEF.title });

    fireEvent.click(within(review).getByRole("checkbox", { name: TASK_REVIEW_BRIEF.title }));

    expect(
      await screen.findByText(`«${TASK_REVIEW_BRIEF.title}» quedó hecha.`),
    ).toBeInTheDocument();
    const done = requests.find((request) => request.path.endsWith("/done"));
    expect(done?.path).toBe(`/api/v1/tasks/${TASK_REVIEW_BRIEF.id}/done`);
    expect(done?.headers["x-xsrf-token"]).toBe("token-1");
    // The list only has pending tasks: it leaves.
    await waitFor(() =>
      expect(screen.queryByRole("article", { name: TASK_REVIEW_BRIEF.title })).toBeNull(),
    );
    expect(await screen.findByText("Tenés 3 tareas pendientes, 1 vencida.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deshacé" }));

    expect(
      await screen.findByRole("article", { name: TASK_REVIEW_BRIEF.title }),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith("/reopen"))).toBe(true);
  });

  it("archives a task (never deletes it) and restores it", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    const week = await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title });

    expect(within(week).queryByRole("button", { name: /Eliminá|Borrá/ })).toBeNull();
    fireEvent.click(
      within(week).getByRole("button", { name: `Archivá la tarea ${TASK_WEEK_REVIEW.title}` }),
    );

    expect(
      await screen.findByText(`«${TASK_WEEK_REVIEW.title}» quedó archivada.`),
    ).toBeInTheDocument();
    expect(requests.some((r) => r.path === `/api/v1/tasks/${TASK_WEEK_REVIEW.id}/archive`)).toBe(
      true,
    );
    await waitFor(() =>
      expect(screen.queryByRole("article", { name: TASK_WEEK_REVIEW.title })).toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Deshacé" }));
    expect(
      await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title }),
    ).toBeInTheDocument();
    expect(requests.some((r) => r.path === `/api/v1/tasks/${TASK_WEEK_REVIEW.id}/restore`)).toBe(
      true,
    );
  });

  it("lets a paralegal mark someone else's task done, but not edit or archive it", async () => {
    signedIn(
      { ...DEMO_ME, id: "00000000-0000-4000-8000-000000000004", role: "PARALEGAL" },
      {
        ...taskRoutes(),
      },
    );
    renderApp(`/tareas?persona=${LAWYER_HUGO.id}`);

    const notice = await screen.findByRole("article", { name: TASK_HUGO_NOTICE.title });
    expect(within(notice).getByRole("checkbox")).toBeEnabled();
    expect(within(notice).queryByRole("button", { name: /Editá/ })).toBeNull();
    expect(within(notice).queryByRole("button", { name: /Archivá/ })).toBeNull();
  });

  it("ticks the checkbox at once and unticks it when the server fails", async () => {
    let answer: (response: Response) => void = () => undefined;
    signedIn(undefined, {
      ...taskRoutes(),
      [`POST /api/v1/tasks/${TASK_REVIEW_BRIEF.id}/done`]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    renderApp("/tareas");
    const review = await screen.findByRole("article", { name: TASK_REVIEW_BRIEF.title });
    const checkbox = within(review).getByRole("checkbox", { name: TASK_REVIEW_BRIEF.title });

    fireEvent.click(checkbox);

    // Optimistic: checked before the server answers.
    await waitFor(() => expect(checkbox).toBeChecked());
    answer(problem(500, "internal"));

    expect(await screen.findByRole("alert")).toHaveTextContent("no se guardó el cambio");
    await waitFor(() =>
      expect(
        within(screen.getByRole("article", { name: TASK_REVIEW_BRIEF.title })).getByRole(
          "checkbox",
        ),
      ).not.toBeChecked(),
    );
  });

  it("gives every quick tick its own answer", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/tareas");
    const review = await screen.findByRole("article", { name: TASK_REVIEW_BRIEF.title });
    const call = screen.getByRole("article", { name: TASK_FAMILY_CALL.title });

    fireEvent.click(within(review).getByRole("checkbox"));
    fireEvent.click(within(call).getByRole("checkbox"));

    expect(await screen.findByText(/» quedó hecha\.$/)).toBeInTheDocument();
    expect(requests.filter((request) => request.path.endsWith("/done"))).toHaveLength(2);
    await waitFor(() => expect(screen.queryAllByRole("article")).toHaveLength(2));
  });

  it("explains when an action is not allowed", async () => {
    signedIn(undefined, {
      ...taskRoutes(),
      [`POST /api/v1/tasks/${TASK_WEEK_REVIEW.id}/archive`]: () => problem(403, "access-denied"),
    });
    renderApp("/tareas");
    const week = await screen.findByRole("article", { name: TASK_WEEK_REVIEW.title });

    fireEvent.click(within(week).getByRole("button", { name: /Archivá la tarea/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No podés hacer esto con esta tarea",
    );
    expect(screen.getByRole("article", { name: TASK_WEEK_REVIEW.title })).toBeInTheDocument();
  });

  it("invites to add the first task when there are none", async () => {
    signedIn(undefined, taskRoutes([]));
    renderApp("/tareas");

    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés tareas pendientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No tenés tareas pendientes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrá las hechas" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés tareas" }),
    ).toBeInTheDocument();
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/tasks": ({ query }) =>
        fail && query.size === "20"
          ? problem(500, "internal")
          : json(200, { items: [], page: 0, size: 20, total: 0 }),
    });
    renderApp("/tareas");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar las tareas");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés tareas pendientes" }),
    ).toBeInTheDocument();
  });
});
