import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agendaQueryOptions } from "@/features/agenda/agenda-queries";
import {
  agendaFor,
  DETAINEE_ALERTS,
  FIXTURE_NOW,
  LAWYER_PAULA,
  WEEK_HEARINGS,
} from "@/test/agenda-fixtures";
import { json, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

/** The fake backend answers the agenda like the real one: by local day and lawyer. */
function agendaBackend(
  options: { items?: typeof WEEK_HEARINGS; alerts?: typeof DETAINEE_ALERTS } = {},
) {
  return signedIn(undefined, {
    "GET /api/v1/agenda": ({ query }: RecordedRequest) =>
      json(
        200,
        agendaFor(options.items ?? WEEK_HEARINGS, query.from ?? "", query.to ?? "", query.lawyerId),
      ),
    "GET /api/v1/detainee-alerts": () => json(200, options.alerts ?? DETAINEE_ALERTS),
  });
}

const agendaRequests = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/agenda").map((request) => request.query);

describe("HomePage (agenda)", () => {
  beforeEach(() => {
    // Only Date: timers stay real so Testing Library and TanStack Query keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows today's hearings on the rail, in the firm's time, with the 'Ahora' line", async () => {
    const requests = agendaBackend();
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lunes 23 de noviembre de 2026")).toBeInTheDocument();
    expect(
      await screen.findByText("Hoy tenés 5 audiencias, 2 con personas detenidas."),
    ).toBeInTheDocument();
    expect(agendaRequests(requests)).toEqual([{ from: "2026-11-23", to: "2026-11-23" }]);

    const rail = screen.getByRole("list", { name: "Audiencias del día, en orden" });
    const slots = within(rail).getAllByRole("listitem");
    // 08:30 and 09:45 already started, then "Ahora" (10:20), then 11:00, 11:30 and 16:00.
    expect(slots.map((slot) => slot.querySelector("time")?.textContent)).toEqual([
      "08:30",
      "09:45",
      "10:20",
      "11:00",
      "11:30",
      "16:00",
    ]);
    expect(slots[2]).toHaveAccessibleName("Ahora son las 10:20");

    const review = screen.getByRole("article", { name: "Revisión de prisión preventiva" });
    expect(within(review).getByText("CPP art. 118")).toBeInTheDocument();
    expect(within(review).getByText("Programada")).toBeInTheDocument();
    expect(within(review).getByText("Carla Modelo")).toBeInTheDocument();
    expect(within(review).getByText("Persona detenida")).toBeInTheDocument();
    expect(within(review).getByText("Superposición de horario")).toBeInTheDocument();
    expect(within(review).getByText("Sala 5, Ciudad Judicial")).toBeInTheDocument();
    expect(within(review).getByText("Dra. Silvia Muestra")).toBeInTheDocument();
    expect(within(review).getByText("Lucía Ejemplo y Hugo Prueba")).toBeInTheDocument();
    expect(within(review).getByText(/60 min, hasta las/)).toHaveTextContent(
      "60 min, hasta las 12:00",
    );

    const control = screen.getByRole("article", { name: "Control de acusación" });
    expect(within(control).getByText("CPP arts. 167 a 169")).toBeInTheDocument();
    expect(within(control).getByText("Diego Ejemplar y Nora Ficticia")).toBeInTheDocument();
  });

  it("collapses hearings that already ended and opens them on demand", async () => {
    agendaBackend();
    renderApp("/");

    const finished = await screen.findByRole("article", { name: "Formulación de cargos" });
    expect(within(finished).queryByText("Sala 2, Ciudad Judicial")).not.toBeInTheDocument();
    const toggle = within(finished).getByRole("button", { name: "Mirá el detalle" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(within(finished).getByText("Sala 2, Ciudad Judicial")).toBeInTheDocument();
    expect(within(finished).getByRole("button", { name: "Ocultá el detalle" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows the detainee alerts first, with the legal source and the disclaimer", async () => {
    agendaBackend();
    renderApp("/");

    const alerts = await screen.findByRole("region", {
      name: "2 avisos sobre personas detenidas",
    });
    expect(alerts).toHaveTextContent(
      "Carla Modelo. La revisión de la medida es el miércoles 25/11 (en 2 días).",
    );
    expect(alerts).toHaveTextContent(
      "Modelo, Carla s/ homicidio en grado de tentativa. CPP art. 118.",
    );
    expect(alerts).toHaveTextContent("Cálculo asistido: verificá con la norma.");
    // Before the hearings in reading order.
    const rail = screen.getByRole("list", { name: "Audiencias del día, en orden" });
    expect(alerts.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("switches to the week, grouped by day, and keeps it in the URL", async () => {
    const requests = agendaBackend();
    const { router } = renderApp("/");
    await screen.findByRole("article", { name: "Revisión de prisión preventiva" });

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Audiencias de esta semana" }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ vista: "semana" });
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Del 23 al 29 de noviembre")).toBeInTheDocument();
    expect(
      await screen.findByText("Esta semana tenés 8 audiencias, 3 con personas detenidas."),
    ).toBeInTheDocument();
    expect(agendaRequests(requests).at(-1)).toEqual({ from: "2026-11-23", to: "2026-11-29" });

    // Every h2 but the "Tareas de hoy" and "Novedades" cards is a day of the week.
    const days = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
      .filter((text) => text !== "Tareas de hoy" && text !== "Novedades");
    expect(days).toEqual([
      "Lunes 23 de noviembre. Ver el día",
      "Martes 24 de noviembre. Ver el día",
      "Miércoles 25 de noviembre. Ver el día",
      "Jueves 26 de noviembre. Ver el día",
      "Viernes 27 de noviembre. Ver el día",
      "Sábado 28 de noviembre. Ver el día",
      "Domingo 29 de noviembre. Ver el día",
    ]);
    const thursday = screen.getByRole("region", { name: "Jueves 26 de noviembre. Ver el día" });
    expect(thursday).toHaveTextContent("Sin audiencias");
    const monday = screen.getByRole("region", { name: "Lunes 23 de noviembre. Ver el día" });
    expect(within(monday).getAllByRole("article")).toHaveLength(5);
    const friday = screen.getByRole("region", { name: "Viernes 27 de noviembre. Ver el día" });
    // "Otra" has no CPP article: none is invented.
    expect(within(friday).getByRole("article", { name: "Otra" })).not.toHaveTextContent("CPP");

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ vista: "semana", fecha: "2026-11-30" }),
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés audiencias esa semana" }),
    ).toBeInTheDocument();
  });

  it("opens a day from the week view", async () => {
    agendaBackend();
    const { router } = renderApp("/?vista=semana");

    fireEvent.click(
      await screen.findByRole("link", { name: "Martes 24 de noviembre. Ver el día" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Audiencias de mañana" }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ fecha: "2026-11-24" });
    expect(
      await screen.findByRole("article", { name: "Control de la investigación" }),
    ).toBeInTheDocument();
  });

  it("moves between days and back to today", async () => {
    const requests = agendaBackend();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    fireEvent.click(screen.getByRole("button", { name: "Día anterior" }));
    await screen.findByRole("heading", { level: 1, name: "Audiencias del día" });
    expect(router.state.location.search).toEqual({ fecha: "2026-11-22" });
    expect(screen.getByText("Domingo 22 de noviembre de 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    expect(router.state.location.search).toEqual({});
    expect(agendaRequests(requests).map((query) => query.from)).toContain("2026-11-22");
  });

  it("filters by lawyer and says whose agenda it is", async () => {
    const requests = agendaBackend();
    const { router } = renderApp("/");
    await screen.findByText("Hoy tenés 5 audiencias, 2 con personas detenidas.");

    const filter = screen.getByLabelText("Abogado o abogada");
    expect(
      within(filter)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Todo el estudio", "Mis audiencias", "Hugo Prueba", "Paula Demo"]);

    fireEvent.change(filter, { target: { value: LAWYER_PAULA.id } });

    expect(
      await screen.findByText("Paula Demo tiene 1 audiencia hoy, 1 con una persona detenida."),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ abogado: LAWYER_PAULA.id });
    expect(agendaRequests(requests).at(-1)).toEqual({
      from: "2026-11-23",
      to: "2026-11-23",
      lawyerId: LAWYER_PAULA.id,
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("invites to look at the week when today is empty", async () => {
    agendaBackend({ items: [], alerts: [] });
    renderApp("/");

    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés audiencias hoy" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /avisos/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mirá toda la semana" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "No tenés audiencias esta semana" }),
    ).toBeInTheDocument();
  });

  it("offers a lawyer seen in any loaded agenda, even one loaded elsewhere", async () => {
    agendaBackend();
    // Tuesday: only Paula Demo attends.
    const { queryClient } = renderApp("/?fecha=2026-11-24");
    await screen.findByRole("article", { name: "Control de la investigación" });
    const filter = screen.getByLabelText("Abogado o abogada");
    expect(within(filter).queryByRole("option", { name: "Hugo Prueba" })).not.toBeInTheDocument();

    // Another agenda lands in the cache (e.g. prefetched): the filter follows without a reload.
    queryClient.setQueryData(
      agendaQueryOptions({ from: "2026-11-23", to: "2026-11-23" }).queryKey,
      agendaFor(WEEK_HEARINGS, "2026-11-23", "2026-11-23"),
    );

    expect(await within(filter).findByRole("option", { name: "Hugo Prueba" })).toBeInTheDocument();
  });

  it("says when the detainee alerts fail and retries them", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/agenda": ({ query }: RecordedRequest) =>
        json(200, agendaFor(WEEK_HEARINGS, query.from ?? "", query.to ?? "")),
      "GET /api/v1/detainee-alerts": () =>
        fail ? problem(500, "internal") : json(200, DETAINEE_ALERTS),
    });
    renderApp("/");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar los avisos de personas detenidas");
    // The agenda itself still loads.
    expect(
      screen.getByRole("article", { name: "Revisión de prisión preventiva" }),
    ).toBeInTheDocument();

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));

    expect(
      await screen.findByRole("region", { name: "2 avisos sobre personas detenidas" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows three alerts and the rest on demand", async () => {
    const [first] = DETAINEE_ALERTS;
    if (!first) throw new Error("Fixture without alerts");
    const alerts = [
      "Ana Ficticia",
      "Bruno Ejemplo",
      "Ceci Muestra",
      "Dante Demo",
      "Elsa Prueba",
    ].map((defendantName, index) => ({
      ...first,
      defendantName,
      measureId: `00000000-0000-4000-b000-00000000010${index}`,
    }));
    agendaBackend({ alerts });
    renderApp("/");

    const region = await screen.findByRole("region", { name: "5 avisos sobre personas detenidas" });
    const list = within(region).getByRole("list", { name: "Avisos" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(region).not.toHaveTextContent("Elsa Prueba");

    const toggle = within(region).getByRole("button", { name: "Mirá los 5 avisos" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // More than three also overflow wider screens, so the toggle stays visible there.
    expect(toggle).not.toHaveClass("md:hidden");
    fireEvent.click(toggle);

    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(region).toHaveTextContent("Elsa Prueba");
    const collapse = within(region).getByRole("button", { name: "Mostrá menos avisos" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapse);
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps only the first alert on phones until the lawyer asks for the rest", async () => {
    // jsdom applies no CSS: check the responsive classes that hide and show them.
    agendaBackend();
    renderApp("/");

    const region = await screen.findByRole("region", { name: "2 avisos sobre personas detenidas" });
    const items = within(within(region).getByRole("list", { name: "Avisos" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(items[0]).not.toHaveClass("max-md:hidden");
    expect(items[1]).toHaveClass("max-md:hidden");

    // Both fit on wider screens, so the toggle is only for phones.
    const toggle = within(region).getByRole("button", { name: "Mirá los 2 avisos" });
    expect(toggle).toHaveClass("md:hidden");
    fireEvent.click(toggle);
    expect(items[1]).not.toHaveClass("max-md:hidden");
    expect(within(region).getByRole("button", { name: "Mostrá menos avisos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/agenda": ({ query }: RecordedRequest) =>
        fail
          ? problem(500, "internal")
          : json(200, agendaFor(WEEK_HEARINGS, query.from ?? "", query.to ?? "")),
      "GET /api/v1/detainee-alerts": () => json(200, []),
    });
    renderApp("/");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar la agenda");
    expect(alert).toHaveTextContent("Volvé a intentar en unos minutos.");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));

    expect(
      await screen.findByRole("article", { name: "Revisión de prisión preventiva" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
