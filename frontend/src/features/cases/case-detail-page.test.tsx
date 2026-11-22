import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agendaFor, FIXTURE_NOW, MONDAY_HEARINGS } from "@/test/agenda-fixtures";
import {
  ARCHIVED_DETAIL,
  CASE_MODELO,
  DEFENDANT_CARLA,
  DETAIL_EJEMPLAR,
  DETAIL_MODELO,
  MEASURES,
} from "@/test/case-fixtures";
import { caseRoutes, json, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const section = (name: string) => screen.getByRole("region", { name });

describe("CaseDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the header, the summary, the numbers, the parties and the team", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: DETAIL_MODELO.caption }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Todas las causas" })).toHaveAttribute(
      "href",
      "/causas",
    );

    const summary = section("Resumen");
    expect(summary).toHaveTextContent("1 imputado");
    expect(within(summary).getByText("1 persona detenida")).toBeInTheDocument();
    expect(summary).toHaveTextContent("Investigación preparatoria");
    expect(summary).toHaveTextContent("Lunes 23 de noviembre de 2026, 11:00");
    expect(summary).toHaveTextContent("Revisión de prisión preventiva");

    const data = section("Datos de la causa");
    expect(data).toHaveTextContent("MPFNQ 10234/2026");
    expect(data).toHaveTextContent("OFI-DEMO 4521/2026");
    expect(data).toHaveTextContent("PEH-DEMO 7788");
    expect(data).toHaveTextContent("DEMO-0098/2026");
    expect(data).toHaveTextContent("Acción pública (CPP art. 99)");
    expect(data).toHaveTextContent("Defensa");
    expect(data).toHaveTextContent("[validar]");

    const parties = section("Partes");
    expect(parties).toHaveTextContent("Raúl Ficticio");
    expect(parties).toHaveTextContent("Víctima");
    expect(parties).toHaveTextContent("Fiscal");

    // The responsible lawyer first.
    const team = within(section("Equipo")).getAllByRole("listitem");
    expect(team.map((member) => member.textContent)).toEqual([
      "Lucía EjemploResponsable",
      "Hugo PruebaColaboración",
    ]);
  });

  it("shows each defendant with the liberty situation, defence and charges", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const carla = await screen.findByRole("article", { name: "Carla Modelo" });
    expect(await within(carla).findByText("En prisión preventiva")).toBeInTheDocument();
    expect(carla).toHaveTextContent("CPP arts. 113 y 119");
    expect(
      within(carla).getByRole("list", { name: "Medidas de coerción vigentes" }),
    ).toHaveTextContent(
      "Prisión preventiva (CPP arts. 114 a 119), hasta el 04/12/2026, revisión el 25/11/2026. Unidad de detención ficticia 11",
    );
    expect(carla).toHaveTextContent("Investigación preparatoria (CPP arts. 133 a 158)");
    expect(carla).toHaveTextContent("En trámite");
    expect(carla).toHaveTextContent("12/05/2026");
    expect(carla).toHaveTextContent("El estudio");
    expect(carla).toHaveTextContent("Homicidio en grado de tentativa (CP arts. 79 y 42)");
    expect(carla).not.toHaveTextContent("Rebeldía");
  });

  it("splits the case's hearings into upcoming and past ones", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const hearings = await screen.findByRole("region", { name: "Audiencias" });
    const upcoming = await within(hearings).findByRole("region", { name: "Próximas" });
    expect(
      within(upcoming).getByRole("article", { name: "Revisión de prisión preventiva" }),
    ).toHaveTextContent("Programada");
    const past = within(hearings).getByRole("region", { name: "Anteriores" });
    const charges = within(past).getByRole("article", { name: "Formulación de cargos" });
    expect(charges).toHaveTextContent("Martes 12 de mayo de 2026, 09:00");
    expect(charges).toHaveTextContent("Efectiva");
    expect(charges).toHaveTextContent("Se formularon cargos");
  });

  it("marks a reserved case and shows rebellion and the other counsel", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${DETAIL_EJEMPLAR.id}`);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      DETAIL_EJEMPLAR.caption,
    );
    expect(screen.getByText("Reservada")).toBeInTheDocument();

    const nora = screen.getByRole("article", { name: "Nora Ficticia" });
    expect(await within(nora).findByText("Prófugo o rebelde")).toBeInTheDocument();
    expect(nora).toHaveTextContent("Rebeldía (CPP art. 52)");
    expect(nora).toHaveTextContent("Declarada el 01/08/2026");
    expect(nora).toHaveTextContent("Defensa oficial: Defensoría Pública ficticia 2");

    const diego = screen.getByRole("article", { name: "Diego Ejemplar" });
    expect(await within(diego).findByText("En libertad sin medidas")).toBeInTheDocument();
    expect(section("Partes")).toHaveTextContent("Todavía no hay otras partes cargadas");
    expect(section("Audiencias")).toHaveTextContent("todavía no tiene audiencias");
  });

  it("says when a case is archived", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${ARCHIVED_DETAIL.id}`);

    expect(await screen.findByText("Esta causa está archivada")).toBeInTheDocument();
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    const ana = screen.getByRole("article", { name: "Ana Prueba" });
    expect(ana).toHaveTextContent("Sobreseimiento");
    expect(ana).toHaveTextContent("Cerrado");
  });

  it("answers a missing or hidden case with a not-found page", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/cases/${CASE_MODELO.id}`]: () => problem(404, "not-found"),
    });
    renderApp(`/causas/${CASE_MODELO.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos esta causa" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volvé a las causas" })).toHaveAttribute(
      "href",
      "/causas",
    );
  });

  it("does not ask the server for an id that cannot be a case", async () => {
    const requests = signedIn(undefined, caseRoutes());
    renderApp("/causas/no-es-un-id");

    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos esta causa" }),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path.startsWith("/api/v1/cases/"))).toBe(false);
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/cases/${DETAIL_MODELO.id}`]: () =>
        fail ? problem(500, "internal") : json(200, DETAIL_MODELO),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar la causa");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: DETAIL_MODELO.caption }),
    ).toBeInTheDocument();
  });

  it("keeps a closed defendant with a custodial measure in force as detained, and asks to check it", async () => {
    const closed = { ...DEFENDANT_CARLA, status: "CLOSED" as const };
    signedIn(undefined, {
      ...caseRoutes({ details: [{ ...DETAIL_MODELO, defendants: [closed] }] }),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const carla = await screen.findByRole("article", { name: "Carla Modelo" });
    // Same as the case's summary (the backend counts the measure, not the status).
    expect(await within(carla).findByText("En prisión preventiva")).toBeInTheDocument();
    expect(within(section("Resumen")).getByText("1 persona detenida")).toBeInTheDocument();
    expect(carla).toHaveTextContent(
      "Su proceso figura como «cerrado» pero la medida sigue vigente en el sistema.",
    );
  });

  it("does not count a measure that has not started yet", async () => {
    const [prison] = MEASURES[DEFENDANT_CARLA.id] ?? [];
    if (!prison) throw new Error("Fixture without measures");
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/defendants/${DEFENDANT_CARLA.id}/coercive-measures`]: () =>
        json(200, [{ ...prison, startsOn: "2026-11-30" }]),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const carla = await screen.findByRole("article", { name: "Carla Modelo" });
    expect(await within(carla).findByText("En libertad sin medidas")).toBeInTheDocument();
    expect(within(carla).queryByRole("list", { name: /Medidas/ })).not.toBeInTheDocument();
  });

  it("shows the liberty situation loading, then explains a failure and retries", async () => {
    let fail = true;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/defendants/${DEFENDANT_CARLA.id}/coercive-measures`]: async () => {
        await gate;
        return fail ? problem(500, "internal") : json(200, MEASURES[DEFENDANT_CARLA.id]);
      },
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const carla = await screen.findByRole("article", { name: "Carla Modelo" });
    expect(
      within(carla).getByRole("status", { name: "Cargando la situación de libertad" }),
    ).toBeInTheDocument();

    release();
    expect(
      await within(carla).findByText(/No pudimos cargar las medidas de coerción/, undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(carla).not.toHaveTextContent("En prisión preventiva");

    fail = false;
    fireEvent.click(within(carla).getByRole("button", { name: "Volvé a intentar" }));
    expect(await within(carla).findByText("En prisión preventiva")).toBeInTheDocument();
  });

  it("explains when the hearings fail and retries them", async () => {
    let fail = true;
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/cases/${DETAIL_MODELO.id}/hearings`]: () =>
        fail ? problem(500, "internal") : json(200, []),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar las audiencias de la causa");
    // The rest of the case still shows.
    expect(screen.getByRole("heading", { level: 1, name: DETAIL_MODELO.caption })).toBeVisible();

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(await screen.findByText(/todavía no tiene audiencias/)).toBeInTheDocument();
  });

  it("still shows the case with the record's own names when the catalogs fail", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/catalogs/stages": () => problem(500, "internal"),
      "GET /api/v1/catalogs/hearing-types": () => problem(500, "internal"),
      "GET /api/v1/catalogs/liberty-situations": () => problem(500, "internal"),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: DETAIL_MODELO.caption },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    // Stage from the defendant, liberty from the package names; no article is invented.
    expect(section("Resumen")).toHaveTextContent("Investigación preparatoria");
    const carla = screen.getByRole("article", { name: "Carla Modelo" });
    expect(await within(carla).findByText("En prisión preventiva")).toBeInTheDocument();
    expect(carla).not.toHaveTextContent("CPP arts. 113 y 119");
  });

  it("is reached from the hearing's card in the agenda", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/agenda": ({ query }: RecordedRequest) =>
        json(200, agendaFor(MONDAY_HEARINGS, query.from ?? "", query.to ?? "")),
    });
    const { router } = renderApp("/");

    const review = await screen.findByRole("article", { name: "Revisión de prisión preventiva" });
    fireEvent.click(within(review).getByRole("link", { name: CASE_MODELO.caption }));

    expect(
      await screen.findByRole("heading", { level: 1, name: CASE_MODELO.caption }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/causas/${CASE_MODELO.id}`);
  });
});
