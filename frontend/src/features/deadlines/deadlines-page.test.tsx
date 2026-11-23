import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_EJEMPLO, CASE_MODELO } from "@/test/case-fixtures";
import { DEADLINE_INVESTIGATION_DIEGO, DEADLINE_MEDIATION_MUESTRA } from "@/test/deadline-fixtures";
import {
  caseRoutes,
  deadlineRoutes,
  json,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const deadlineRequests = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.path === "/api/v1/deadlines")
    .map((request) => request.query);

const group = (name: RegExp) => screen.getByRole("region", { name });
const card = (name: string) => screen.getByRole("article", { name });

describe("DeadlinesPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups the deadlines by urgency, detainees first, each with its source and disclaimer", async () => {
    const requests = signedIn(undefined, deadlineRoutes());
    renderApp("/plazos");

    expect(await screen.findByRole("heading", { level: 1, name: "Plazos" })).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Tenés 6 plazos para atender en los próximos 30 días, 2 de personas detenidas.",
      ),
    ).toBeInTheDocument();
    expect(deadlineRequests(requests)).toEqual([{ withinDays: "30" }]);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Vencidos1 plazo",
      "Vencen pronto3 plazos",
      "Próximos1 plazo",
      "Sin calcular1 plazo",
    ]);

    // Inside "Vencen pronto" the two detainee deadlines come before the investigation.
    const dueSoon = within(group(/Vencen pronto/)).getAllByRole("article");
    expect(dueSoon.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      "Detención sin control judicial",
      "Audiencia de revisión de prisión preventiva",
      "Duración de la investigación preparatoria",
    ]);

    const control = card("Detención sin control judicial");
    expect(within(control).getByText("Persona detenida")).toBeInTheDocument();
    expect(control).toHaveTextContent("Art. 112; 49 inc. 5 · CPP de Neuquén (Ley 2784)");
    expect(within(control).getByText("[validar]")).toBeInTheDocument();
    expect(control).toHaveTextContent("Vence el martes 24 de noviembre de 2026, 02:00");
    expect(control).toHaveTextContent("Quedan 15 horas");
    expect(control).toHaveTextContent("Plazo legal: 24 horas corridas");
    expect(control).toHaveTextContent("Si vence: Libertad");
    expect(control).toHaveTextContent("Lucas Ejemplo");
    expect(within(control).getByRole("link", { name: CASE_EJEMPLO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_EJEMPLO.id}`,
    );
    expect(control).toHaveTextContent("Cálculo asistido: verificá con la norma.");

    // Every card carries the disclaimer, never only in a tooltip.
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(6);
    for (const item of cards) {
      expect(item).toHaveTextContent("Cálculo asistido: verificá con la norma.");
    }

    const investigation = card(DEADLINE_INVESTIGATION_DIEGO.rule.name);
    expect(within(investigation).queryByText("Persona detenida")).not.toBeInTheDocument();
    expect(within(investigation).getByText("[no verificado]")).toBeInTheDocument();
    expect(investigation).toHaveTextContent("1 prórroga concedida");
    expect(investigation).toHaveTextContent("Juez de garantías: 4 meses, concedida el 20/07/2026");
    expect(investigation).toHaveTextContent("(hasta las 24)");
    const note = within(investigation).getByRole("link", { name: /Leé la nota/ });
    expect(note).toHaveAttribute("target", "_blank");
    expect(note).toHaveAttribute("rel", "noopener noreferrer");

    expect(card(DEADLINE_MEDIATION_MUESTRA.rule.name)).toHaveTextContent("Venció hace 3 días");
    const judicial = card("Plazo fijado por el juez o el fiscal");
    expect(judicial).toHaveTextContent("Plazo judicial: Fecha que fijó el juez o la fiscalía");

    const appeal = card("Impugnación ordinaria");
    expect(appeal).toHaveTextContent("el calendario judicial de 2026");
    expect(appeal).toHaveTextContent("Contalo a mano con la norma");
  });

  it("changes the horizon and keeps it in the URL", async () => {
    const requests = signedIn(undefined, deadlineRoutes());
    const { router } = renderApp("/plazos");
    await screen.findByText(/Tenés 6 plazos/);

    const horizon = screen.getByRole("group", { name: "Horizonte" });
    expect(within(horizon).getByRole("button", { name: "30 días" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(horizon).getByRole("button", { name: "7 días" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ dias: 7 }));
    expect(
      await screen.findByText(
        "Tenés 5 plazos para atender en los próximos 7 días, 2 de personas detenidas.",
      ),
    ).toBeInTheDocument();
    expect(deadlineRequests(requests).at(-1)).toEqual({ withinDays: "7" });
    expect(
      screen.queryByRole("article", { name: "Plazo fijado por el juez o el fiscal" }),
    ).toBeNull();
  });

  it("restores the horizon and the detainee filter from a shared link", async () => {
    const requests = signedIn(undefined, deadlineRoutes());
    renderApp("/plazos?dias=60&detenidos=si");

    expect(
      await screen.findByText(
        "Tenés 2 plazos de personas detenidas para atender en los próximos 60 días.",
      ),
    ).toBeInTheDocument();
    expect(deadlineRequests(requests)).toEqual([{ withinDays: "60" }]);
    expect(screen.getByRole("switch", { name: "Solo personas detenidas" })).toBeChecked();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    for (const item of screen.getAllByRole("article")) {
      expect(within(item).getByText("Persona detenida")).toBeInTheDocument();
    }
  });

  it("keeps only the detainees' deadlines with the switch and explains when there are none", async () => {
    signedIn(undefined, deadlineRoutes([DEADLINE_MEDIATION_MUESTRA]));
    const { router } = renderApp("/plazos");
    await screen.findByText("Tenés 1 plazo para atender en los próximos 30 días.");

    fireEvent.click(screen.getByRole("switch", { name: "Solo personas detenidas" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ detenidos: "si" }));
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No hay plazos de personas detenidas en los próximos 30 días",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrá todos los plazos" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("article", { name: "Mediación penal" })).toBeInTheDocument();
  });

  it("says when there is nothing in the horizon and offers a wider one", async () => {
    const requests = signedIn(undefined, deadlineRoutes([]));
    const { router } = renderApp("/plazos?dias=15");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No hay plazos en los próximos 15 días",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrí las causas" })).toHaveAttribute(
      "href",
      "/causas",
    );
    fireEvent.click(screen.getByRole("button", { name: "Mirá los próximos 30 días" }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No hay plazos en los próximos 30 días",
      }),
    ).toBeInTheDocument();
    expect(deadlineRequests(requests).at(-1)).toEqual({ withinDays: "30" });
  });

  it("opens the case of a deadline", async () => {
    signedIn(undefined, { ...caseRoutes(), ...deadlineRoutes() });
    const { router } = renderApp("/plazos");

    fireEvent.click(
      within(
        await screen.findByRole("article", { name: "Audiencia de revisión de prisión preventiva" }),
      ).getByRole("link", { name: CASE_MODELO.caption }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: CASE_MODELO.caption }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/causas/${CASE_MODELO.id}`);
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/deadlines": () => (fail ? problem(500, "internal") : json(200, [])),
    });
    renderApp("/plazos");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar los plazos");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No hay plazos en los próximos 30 días",
      }),
    ).toBeInTheDocument();
  });
});
