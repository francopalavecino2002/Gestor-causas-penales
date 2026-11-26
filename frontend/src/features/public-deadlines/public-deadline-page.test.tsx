import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  mockFetch,
  problem,
  publicDeadlineRoutes,
  signedOut,
  type RecordedRequest,
} from "@/test/mock-api";
import {
  CALENDAR_SOURCE,
  PUBLIC_CONTROL,
  PUBLIC_IMPUGNACION,
} from "@/test/public-deadline-fixtures";
import { renderApp } from "@/test/render-app";

const PATH = "/calculadora-de-plazos";

const calculations = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/public/deadline-calculation");

async function openCalculator() {
  await screen.findByRole("heading", {
    level: 1,
    name: "Calculadora de plazos del CPP de Neuquén",
  });
  return screen.findByLabelText("Plazo");
}

function fill(rule: string, startDate: string) {
  fireEvent.change(screen.getByLabelText("Plazo"), { target: { value: rule } });
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: startDate } });
}

const calculateButton = () => screen.getByRole("button", { name: "Calculá el vencimiento" });

describe("public deadline calculator", () => {
  it("works without a session: never asks for /me and lists the rules, detainee ones first", async () => {
    const requests = mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    const select = await openCalculator();

    expect(document.title).toBe(
      "Calculadora de plazos del CPP de Neuquén | Gestor de causas penales",
    );
    const groups = within(select).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("label"))).toEqual([
      "Personas detenidas",
      "Otros plazos",
    ]);
    expect(
      within(groups[1]!).getByRole("option", {
        name: "Impugnación ordinaria (Art. 242) [validar] [no verificado]",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: /Ingresá/ })[0]).toHaveAttribute(
      "href",
      "/ingresar",
    );
    expect(requests.map((request) => request.path)).not.toContain("/api/v1/me");
  });

  it("shows what starts the chosen rule, how it counts and what happens when it ends", async () => {
    mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    const select = await openCalculator();

    fireEvent.change(select, { target: { value: PUBLIC_IMPUGNACION.code } });
    const summary = await screen.findByText("Notificación de la decisión");
    expect(summary.closest("dl")).toHaveTextContent("Cómo se cuenta: 5 días hábiles");
    expect(summary.closest("dl")).toHaveTextContent("Si vence: Caduca el derecho a impugnar");
    expect(screen.queryByLabelText("Hora de inicio")).toBeNull();
  });

  it("asks for the rule before calculating", async () => {
    const requests = mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    await openCalculator();

    fireEvent.click(calculateButton());
    expect(await screen.findByText("Elegí el plazo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Plazo")).toHaveAttribute("aria-invalid", "true");
    expect(calculations(requests)).toEqual([]);
  });

  it("computes a business-day term to 24 h of its last day, with the court calendar", async () => {
    const requests = mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    await openCalculator();

    fill(PUBLIC_IMPUGNACION.code, "2026-11-20");
    fireEvent.click(calculateButton());

    const result = await screen.findByRole("region", { name: "Impugnación ordinaria: vence el" });
    expect(calculations(requests).map((request) => request.query)).toEqual([
      { rule: PUBLIC_IMPUGNACION.code, startDate: "2026-11-20" },
    ]);
    expect(within(result).getByText("Lunes 30 de noviembre de 2026")).toBeVisible();
    expect(within(result).getByText("a las 24 h")).toBeVisible();
    expect(within(result).getByText("20/11/2026")).toBeVisible();
    expect(within(result).getByText("30/11/2026, 24 h")).toBeVisible();
    expect(result).toHaveTextContent(
      "Art. 242 · CPP de Neuquén (Ley 2784) [validar] [no verificado]",
    );
    expect(result).toHaveTextContent(`Calendario judicial: ${CALENDAR_SOURCE} [validar]`);
    expect(within(result).getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();
    expect(result).toHaveTextContent("No guardamos nada de lo que cargás");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Vence el lunes 30 de noviembre de 2026 a las 24 h.",
    );
  });

  it("asks for the start time of a term in hours and ends it at that exact time", async () => {
    const requests = mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    await openCalculator();

    fill(PUBLIC_CONTROL.code, "2026-11-20");
    const time = await screen.findByLabelText("Hora de inicio");
    fireEvent.click(calculateButton());
    expect(
      await screen.findByText("Este plazo corre en horas: escribí la hora, por ejemplo 10:30."),
    ).toBeInTheDocument();
    expect(calculations(requests)).toEqual([]);

    fireEvent.change(time, { target: { value: "10:30" } });
    fireEvent.click(calculateButton());

    const result = await screen.findByRole("region", {
      name: "Detención sin control judicial: vence el",
    });
    expect(calculations(requests).map((request) => request.query)).toEqual([
      { rule: PUBLIC_CONTROL.code, startDate: "2026-11-20", startTime: "10:30" },
    ]);
    expect(within(result).getByText("Sábado 21 de noviembre de 2026")).toBeVisible();
    expect(result).toHaveTextContent("a las 10:30 (hora de Neuquén)");
    expect(within(result).getByText("20/11/2026, 10:30")).toBeVisible();
    expect(within(result).getByText("Persona detenida")).toBeVisible();
    expect(result).not.toHaveTextContent("Calendario judicial");
  });

  it("says so when the court calendar of the year is not loaded yet", async () => {
    mockFetch(publicDeadlineRoutes());
    renderApp(PATH);
    await openCalculator();

    fill(PUBLIC_IMPUGNACION.code, "2027-12-28");
    fireEvent.click(calculateButton());

    expect(
      await screen.findByRole("heading", {
        name: "No se puede calcular: el calendario judicial de 2028 todavía no está cargado",
      }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se puede calcular: el calendario judicial de 2028",
    );
  });

  it("explains the rate limit and keeps the form", async () => {
    mockFetch({
      ...publicDeadlineRoutes(),
      "GET /api/v1/public/deadline-calculation": () =>
        problem(429, "public-calculator-throttled", { "Retry-After": "30" }),
    });
    renderApp(PATH);
    await openCalculator();

    fill(PUBLIC_IMPUGNACION.code, "2026-11-20");
    fireEvent.click(calculateButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hiciste muchas consultas seguidas. Esperá un momento y probá de nuevo. Podés volver a calcular en 30 segundos.",
    );
    expect(screen.getByLabelText("Plazo")).toHaveValue(PUBLIC_IMPUGNACION.code);
  });

  it("explains the rate limit when the list of rules cannot load", async () => {
    mockFetch({
      "GET /api/v1/public/deadline-rules": () => problem(429, "public-calculator-throttled"),
    });
    renderApp(PATH);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar los plazos");
    expect(alert).toHaveTextContent("Hiciste muchas consultas seguidas.");
  });

  it("is linked from the login", async () => {
    signedOut();
    renderApp("/ingresar");

    const link = await screen.findByRole("link", { name: "calculadora de plazos gratuita" });
    expect(link).toHaveAttribute("href", PATH);
    fireEvent.click(link);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Calculadora de plazos del CPP de Neuquén" }),
      ).toBeVisible(),
    );
  });
});
