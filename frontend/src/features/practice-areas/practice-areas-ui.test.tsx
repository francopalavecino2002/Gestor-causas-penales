import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HearingDetail } from "@/features/hearings/hearing-api";
import {
  agendaFor,
  DETAINEE_ALERTS,
  FIXTURE_NOW,
  hearing,
  LAWYER_LUCIA,
} from "@/test/agenda-fixtures";
import {
  availableAreas,
  CASE_CIVIL,
  CIVIL_AREA,
  DETAIL_CIVIL,
  PENAL_AREA,
} from "@/test/area-fixtures";
import { CASES, DETAILS } from "@/test/case-fixtures";
import { PERSON_JULIAN } from "@/test/form-fixtures";
import {
  caseRoutes,
  DEMO_ME,
  json,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const TWO_AREAS = { "GET /api/v1/practice-areas": () => json(200, [PENAL_AREA, CIVIL_AREA]) };

const civilRoutes = () => ({
  ...caseRoutes({ cases: [...CASES, CASE_CIVIL], details: [...DETAILS, DETAIL_CIVIL] }),
  ...TWO_AREAS,
});

const AREA_QUESTION = "¿De qué fuero es la causa?";

async function openNewCase() {
  fireEvent.click(await screen.findByRole("button", { name: "Nueva causa" }));
  const dialog = await screen.findByRole("dialog", { name: "Nueva causa" });
  await within(dialog).findByLabelText("Carátula");
  return dialog;
}

describe("practice areas: Nueva causa", () => {
  it("hides the area choice when the firm works in one area only", async () => {
    signedIn(undefined, caseRoutes());
    renderApp("/causas");
    const dialog = await openNewCase();

    expect(within(dialog).queryByRole("group", { name: AREA_QUESTION })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Legajo del MPF")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tipo de acción")).toBeInTheDocument();
  });

  it("explains in Spanish when the area was turned off meanwhile", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "POST /api/v1/cases": () => problem(409, "practice-area-not-enabled"),
    });
    renderApp("/causas");
    const dialog = await openNewCase();

    fireEvent.change(within(dialog).getByLabelText("Carátula"), {
      target: { value: "Prueba, Lisandro s/ hurto" },
    });
    fireEvent.change(within(dialog).getByLabelText("Circunscripción"), {
      target: { value: "confluencia" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El estudio no trabaja en ese fuero. Elegí otro o habilitalo en Ajustes.",
    );
  });

  it("creates a civil case with its stage and first party, without the criminal fields", async () => {
    const NEW_ID = "00000000-0000-4000-a000-000000000778";
    const created = { ...DETAIL_CIVIL, id: NEW_ID, parties: [] };
    const requests = signedIn(undefined, {
      ...civilRoutes(),
      "POST /api/v1/persons": () => json(201, PERSON_JULIAN),
      "POST /api/v1/cases": () => json(201, created),
      [`POST /api/v1/cases/${NEW_ID}/parties`]: () => json(201, {}),
      [`GET /api/v1/cases/${NEW_ID}`]: () => json(200, created),
      [`GET /api/v1/cases/${NEW_ID}/hearings`]: () => json(200, []),
      [`GET /api/v1/cases/${NEW_ID}/deadlines`]: () => json(200, []),
    });
    const { router } = renderApp("/causas");
    const dialog = await openNewCase();

    const choice = within(dialog).getByRole("group", { name: AREA_QUESTION });
    expect(within(choice).getByRole("radio", { name: /Penal/ })).toBeChecked();
    fireEvent.click(within(choice).getByRole("radio", { name: /Civil y comercial/ }));

    const process = await within(dialog).findByLabelText("Tipo de proceso");
    await waitFor(() => expect(process).toHaveValue("ordinario"));
    expect(dialog).toHaveTextContent("Borrador sin validar");
    expect(within(dialog).queryByLabelText("Legajo del MPF")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Número de la OFIJU")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("checkbox", { name: "Agregá ahora al primer imputado" }),
    ).not.toBeInTheDocument();
    // Status comes later, on edit: a new case starts active.
    expect(within(dialog).queryByLabelText("Estado de la causa")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Carátula"), {
      target: { value: "Ficticio, Julián c/ Ejemplo S.A. s/ daños" },
    });
    fireEvent.change(within(dialog).getByLabelText("Circunscripción"), {
      target: { value: "confluencia" },
    });
    fireEvent.change(within(dialog).getByLabelText("Etapa"), { target: { value: "inicio" } });
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: "Agregá ahora a la primera parte" }),
    );
    fireEvent.click(await within(dialog).findByRole("radio", { name: "Es una persona nueva" }));
    fireEvent.change(within(dialog).getByLabelText("Apellidos"), { target: { value: "Ficticio" } });
    fireEvent.change(within(dialog).getByLabelText("Nombres"), { target: { value: "Julián" } });
    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "99.000.111" },
    });
    expect(within(dialog).getByLabelText("Rol en la causa")).toHaveValue("actor");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/causas/${NEW_ID}`));
    const [person, caseFile, party] = writes(requests);
    expect(person?.path).toBe("/api/v1/persons");
    expect(caseFile?.body).toMatchObject({
      practiceArea: "civil",
      actionType: "ordinario",
      represents: "actor",
      stageCode: "inicio",
      status: "ACTIVE",
      closingOutcomeCode: null,
      mpfLegajo: null,
      ofijuNumber: null,
      pehuenNumber: null,
    });
    expect(party?.path).toBe(`/api/v1/cases/${NEW_ID}/parties`);
    expect(party?.body).toEqual({ personId: PERSON_JULIAN.id, roleCode: "actor" });
    // The civil catalogs were read for the civil area.
    expect(
      requests.some(
        (request) => request.path === "/api/v1/catalogs/stages" && request.query.area === "civil",
      ),
    ).toBe(true);
  });
});

describe("practice areas: case detail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a civil case by its own modules: badge, draft note, stage and parties, no defendants", async () => {
    signedIn(undefined, civilRoutes());
    renderApp(`/causas/${DETAIL_CIVIL.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: DETAIL_CIVIL.caption }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("main")).toHaveTextContent("Fuero: Civil y comercial"),
    );
    expect(screen.getAllByText(/Borrador sin validar/).length).toBeGreaterThan(0);

    const course = screen.getByRole("region", { name: "Etapa y estado" });
    expect(course).toHaveTextContent("Prueba");
    expect(course).toHaveTextContent("En trámite");
    expect(
      within(course).getByRole("button", { name: "Editá la etapa y el estado" }),
    ).toBeVisible();

    expect(screen.queryByRole("region", { name: "Imputados" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumen" })).not.toBeInTheDocument();
    const data = screen.getByRole("region", { name: "Datos de la causa" });
    expect(data).toHaveTextContent("Proceso ordinario");
    expect(data).toHaveTextContent("Parte actora");
    expect(data).not.toHaveTextContent("Legajo del MPF");

    const parties = screen.getByRole("region", { name: "Partes" });
    expect(parties).toHaveTextContent("Juan Ficticio");
    expect(parties).toHaveTextContent("Demandado");
    expect(within(parties).getByRole("button", { name: "Agregá una parte" })).toBeVisible();
  });

  it("adds a party with the area's roles", async () => {
    const requests = signedIn(undefined, {
      ...civilRoutes(),
      "GET /api/v1/persons": () => json(200, { items: [], page: 0, size: 20, total: 0 }),
      "POST /api/v1/persons": () => json(201, PERSON_JULIAN),
      [`POST /api/v1/cases/${DETAIL_CIVIL.id}/parties`]: () => json(201, {}),
    });
    renderApp(`/causas/${DETAIL_CIVIL.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Agregá una parte" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregá una parte" });
    const role = await within(dialog).findByLabelText("Rol en la causa");
    expect(
      within(role)
        .getAllByRole("option")
        .map((option) => option.textContent?.replace(" [validar]", "")),
    ).toEqual(expect.arrayContaining(["Actor", "Demandado", "Tercero"]));
    fireEvent.change(role, { target: { value: "tercero" } });
    fireEvent.click(await within(dialog).findByRole("radio", { name: "Es una persona nueva" }));
    fireEvent.change(within(dialog).getByLabelText("Apellidos"), { target: { value: "Ficticio" } });
    fireEvent.change(within(dialog).getByLabelText("Nombres"), { target: { value: "Julián" } });
    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "99.000.111" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá la parte" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const party = writes(requests).find((request) => request.path.endsWith("/parties"));
    expect(party?.body).toEqual({ personId: PERSON_JULIAN.id, roleCode: "tercero" });
  });

  it("offers the area's hearing types and no defendants or OFIJU fields for a civil case", async () => {
    const saved: HearingDetail = {
      id: "00000000-0000-4000-9000-000000000888",
      caseId: DETAIL_CIVIL.id,
      caseCaption: DETAIL_CIVIL.caption,
      practiceArea: "civil",
      typeCode: "preliminar",
      typeName: "Audiencia preliminar",
      typeArticle: null,
      statusCode: "programada",
      statusName: "Programada",
      startsAt: "2026-11-25T13:00:00Z",
      endsAt: "2026-11-25T14:00:00Z",
      room: null,
      ofijuReference: null,
      requestedBy: null,
      notes: null,
      lawyers: [LAWYER_LUCIA],
      defendants: [],
      clashes: [],
    } as unknown as HearingDetail;
    const requests = signedIn(undefined, {
      ...civilRoutes(),
      [`POST /api/v1/cases/${DETAIL_CIVIL.id}/hearings`]: () => json(201, saved),
    });
    renderApp(`/causas/${DETAIL_CIVIL.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Nueva audiencia" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva audiencia" });
    const type = await within(dialog).findByLabelText("Tipo de audiencia");
    await waitFor(() =>
      expect(
        within(type)
          .getAllByRole("option")
          .map((option) => option.textContent?.replace(" [validar]", "")),
      ).toEqual(expect.arrayContaining(["Audiencia preliminar", "Otra audiencia"])),
    );
    expect(within(dialog).queryByLabelText("Quién la pidió")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("group", { name: "Imputados citados" }),
    ).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("OFIJU");

    fireEvent.change(type, { target: { value: "preliminar" } });
    fireEvent.change(within(dialog).getByLabelText("Día"), { target: { value: "2026-11-25" } });
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "10:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Guardá/ }));

    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    expect(writes(requests)[0]?.path).toBe(`/api/v1/cases/${DETAIL_CIVIL.id}/hearings`);
    expect(writes(requests)[0]?.body).toMatchObject({
      typeCode: "preliminar",
      requestedBy: null,
      defendantIds: [],
    });
  });
});

describe("practice areas: list and agenda", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the criminal list as it was with one area: no filter, no badges", async () => {
    signedIn(undefined, caseRoutes());
    renderApp("/causas");

    await screen.findAllByText(CASES[0]!.caption);
    expect(screen.queryByLabelText("Fuero")).not.toBeInTheDocument();
    expect(screen.queryByText("Fuero:", { exact: false })).not.toBeInTheDocument();
  });

  it("filters the case list by area on the server and badges each case", async () => {
    const requests = signedIn(undefined, civilRoutes());
    const { router } = renderApp("/causas");

    await screen.findAllByText(CASE_CIVIL.caption);
    expect(screen.getAllByText("Civil y comercial").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Fuero"), { target: { value: "civil" } });
    await waitFor(() => expect(router.state.location.search).toMatchObject({ fuero: "civil" }));
    await waitFor(() =>
      expect(
        requests.some(
          (request) => request.path === "/api/v1/cases" && request.query.area === "civil",
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText(CASES[0]!.caption)).not.toBeInTheDocument());
    expect(screen.getAllByText(CASE_CIVIL.caption).length).toBeGreaterThan(0);
  });

  it("filters the agenda by area, with the area's badge on each hearing", async () => {
    const items = [
      hearing("2026-11-23T11:00", { caseCaption: "Ficticio, Martín s/ robo simple" }),
      hearing("2026-11-23T12:00", {
        caseId: CASE_CIVIL.id,
        caseCaption: CASE_CIVIL.caption,
        practiceArea: "civil",
        typeCode: "preliminar",
        typeName: "Audiencia preliminar",
        typeArticle: null,
        defendants: [],
      }),
    ];
    signedIn(undefined, {
      ...TWO_AREAS,
      "GET /api/v1/detainee-alerts": () => json(200, DETAINEE_ALERTS),
      "GET /api/v1/agenda": ({ query }) =>
        json(200, agendaFor(items, query.from ?? "", query.to ?? "", query.lawyerId)),
    });
    renderApp("/");

    expect(await screen.findByText("Audiencia preliminar")).toBeInTheDocument();
    expect(screen.getByText("Formulación de cargos")).toBeInTheDocument();
    expect(screen.getAllByText("Civil y comercial").length).toBeGreaterThan(0);
    expect(await screen.findByText(/avisos sobre personas detenidas/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Fuero"), { target: { value: "civil" } });
    await waitFor(() =>
      expect(screen.queryByText("Formulación de cargos")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Audiencia preliminar")).toBeInTheDocument();
    // Detainee alerts belong to the criminal area.
    expect(screen.queryByText(/avisos sobre personas detenidas/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Fuero"), { target: { value: "penal" } });
    await waitFor(() => expect(screen.queryByText("Audiencia preliminar")).not.toBeInTheDocument());
  });
});

describe("practice areas: Ajustes", () => {
  function areaRoutes(enabled: string[], answer?: () => Response) {
    let state = enabled;
    return {
      ...settingsRoutes().routes,
      "GET /api/v1/practice-areas": () =>
        json(
          200,
          availableAreas(state).filter((area) => area.enabled),
        ),
      "GET /api/v1/practice-areas/available": () => json(200, availableAreas(state)),
      "PUT /api/v1/practice-areas/enabled": ({ body }: RecordedRequest) => {
        if (answer) return answer();
        state = (body as { codes: string[] }).codes;
        return json(200, availableAreas(state));
      },
    };
  }

  it("lets the owner turn an area on, and keeps the last one on", async () => {
    const requests = signedIn(undefined, areaRoutes(["penal"]));
    renderApp("/ajustes/fueros");

    expect(await screen.findByRole("heading", { level: 1, name: "Fueros" })).toBeInTheDocument();
    const penal = await screen.findByRole("switch", { name: /Penal/ });
    expect(penal).toBeChecked();
    expect(penal).toBeDisabled();
    expect(screen.getByText("Tiene que quedar al menos un fuero.")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Civil y comercial" })).toHaveTextContent(
      "[validar]",
    );

    fireEvent.click(screen.getByRole("switch", { name: /Civil y comercial/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Habilitado: Civil y comercial.");
    const [put] = writes(requests);
    expect(put?.path).toBe("/api/v1/practice-areas/enabled");
    expect(put?.body).toEqual({ codes: ["penal", "civil"] });
    expect(put?.headers["x-xsrf-token"]).toBe("token-1");
    await waitFor(() => expect(screen.getByRole("switch", { name: /Penal/ })).toBeEnabled());
  });

  it("explains why an area with active cases stays on", async () => {
    signedIn(
      undefined,
      areaRoutes(["penal", "civil"], () => problem(409, "practice-area-in-use")),
    );
    renderApp("/ajustes/fueros");

    fireEvent.click(await screen.findByRole("switch", { name: /Civil y comercial/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No podés deshabilitar Civil y comercial: tiene causas activas.",
    );
    expect(screen.getByRole("switch", { name: /Civil y comercial/ })).toBeChecked();
  });

  it("shows the areas read-only to a lawyer", async () => {
    signedIn({ ...DEMO_ME, role: "LAWYER" }, areaRoutes(["penal"]));
    renderApp("/ajustes/fueros");

    expect(await screen.findByRole("listitem", { name: "Penal" })).toHaveTextContent("Habilitado");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("chooses the area of the catalogs only when there is more than one", async () => {
    const requests = signedIn(undefined, areaRoutes(["penal", "civil"]));
    const { router } = renderApp("/ajustes/catalogos");

    const area = await screen.findByLabelText("Fuero");
    fireEvent.change(area, { target: { value: "civil" } });
    await waitFor(() => expect(router.state.location.search).toMatchObject({ fuero: "civil" }));
    await waitFor(() =>
      expect(
        requests.some(
          (request) => request.path === "/api/v1/catalogs" && request.query.area === "civil",
        ),
      ).toBe(true),
    );
  });
});
