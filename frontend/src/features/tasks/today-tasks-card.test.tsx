import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_EJEMPLO } from "@/test/case-fixtures";
import { problem, signedIn, taskRoutes, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import {
  TASK_FAMILY_CALL,
  TASK_LEGAJO_COPY,
  TASK_REVIEW_BRIEF,
  TASK_WEEK_REVIEW,
} from "@/test/task-fixtures";

const taskQueries = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/tasks").map((request) => request.query);

const todayCard = () => screen.findByRole("region", { name: "Tareas de hoy" });

describe("Tareas de hoy on the agenda", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows my pending tasks due today and how many are overdue", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/");

    const card = await todayCard();
    const list = await within(card).findByRole("list", { name: "Tareas que vencen hoy" });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(list).getByRole("checkbox", { name: TASK_REVIEW_BRIEF.title })).not.toBeChecked();
    expect(within(list).getByRole("link", { name: CASE_EJEMPLO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_EJEMPLO.id}`,
    );
    expect(within(card).queryByText(TASK_WEEK_REVIEW.title)).toBeNull();
    expect(within(card).queryByText(TASK_LEGAJO_COPY.title)).toBeNull();
    expect(card).toHaveTextContent("2 tareas");
    expect(await within(card).findByText("Tenés 1 tarea vencida.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Mirá todas tus tareas" })).toHaveAttribute(
      "href",
      "/tareas",
    );

    expect(taskQueries(requests)).toEqual(
      expect.arrayContaining([
        { scope: "mine", status: "PENDING", dueOn: "2026-11-23", page: "0", size: "3" },
        { scope: "mine", overdue: "true", page: "0", size: "1" },
      ]),
    );
  });

  it("marks a task done from the card", async () => {
    const requests = signedIn(undefined, taskRoutes());
    renderApp("/");

    const card = await todayCard();
    const checkbox = await within(card).findByRole("checkbox", { name: TASK_FAMILY_CALL.title });
    checkbox.focus();
    fireEvent.click(checkbox);

    const notice = await within(card).findByText(`«${TASK_FAMILY_CALL.title}» quedó hecha.`);
    // The task leaves the card with its checkbox: the focus goes to the notice, not the page.
    await waitFor(() => expect(notice.closest("[tabindex='-1']")).toHaveFocus());
    expect(
      requests.some((request) => request.path === `/api/v1/tasks/${TASK_FAMILY_CALL.id}/done`),
    ).toBe(true);
    await waitFor(() =>
      expect(within(card).queryByRole("checkbox", { name: TASK_FAMILY_CALL.title })).toBeNull(),
    );
  });

  it("says so when nothing is due today", async () => {
    signedIn(undefined, taskRoutes([TASK_WEEK_REVIEW]));
    renderApp("/");

    const card = await todayCard();
    expect(await within(card).findByText("No tenés tareas que venzan hoy.")).toBeInTheDocument();
    expect(within(card).queryByText(/vencida/)).toBeNull();
  });

  it("keeps the agenda usable when the tasks fail to load", async () => {
    signedIn(undefined, { "GET /api/v1/tasks": () => problem(500, "internal") });
    renderApp("/");

    const card = await todayCard();
    expect(
      await within(card).findByText("No pudimos cargar tus tareas de hoy.", undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Audiencias de hoy" }),
    ).toBeInTheDocument();
  });
});
