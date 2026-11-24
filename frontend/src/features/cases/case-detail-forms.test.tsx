import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW, LAWYER_PAULA } from "@/test/agenda-fixtures";
import {
  ARCHIVED_DETAIL,
  DEFENDANT_NORA,
  DETAIL_EJEMPLAR,
  DETAIL_MODELO,
} from "@/test/case-fixtures";
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

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");
const section = (name: string) => screen.getByRole("region", { name });

async function openDialog(button: string, title: string, firstField: string) {
  fireEvent.click(await screen.findByRole("button", { name: button }));
  const dialog = await screen.findByRole("dialog", { name: title });
  await within(dialog).findByLabelText(firstField);
  return dialog;
}

describe("case detail: edit forms", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("edits the case with its saved values and sends no responsible", async () => {
    const updated = { ...DETAIL_MODELO, caption: "Modelo, Carla s/ lesiones" };
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      [`PUT /api/v1/cases/${DETAIL_MODELO.id}`]: () => json(200, updated),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);
    const dialog = await openDialog("Editá la causa", "Editá la causa", "Carátula");

    expect(within(dialog).getByLabelText("Carátula")).toHaveValue(DETAIL_MODELO.caption);
    expect(within(dialog).getByLabelText("Legajo del MPF")).toHaveValue("MPFNQ 10234/2026");
    expect(within(dialog).getByLabelText("Circunscripción")).toHaveValue("confluencia");
    expect(within(dialog).queryByLabelText("Responsable de la causa")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Agregá ahora al primer imputado")).not.toBeInTheDocument();
    // The owner may change the reserved flag.
    expect(within(dialog).getByRole("checkbox", { name: "Causa reservada" })).toBeEnabled();

    fireEvent.change(within(dialog).getByLabelText("Carátula"), {
      target: { value: "Modelo, Carla s/ lesiones" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Modelo, Carla s/ lesiones" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const [put] = writes(requests);
    expect(put?.body).toEqual({
      caption: "Modelo, Carla s/ lesiones",
      internalNumber: "DEMO-0098/2026",
      mpfLegajo: "MPFNQ 10234/2026",
      ofijuNumber: "OFI-DEMO 4521/2026",
      pehuenNumber: "PEH-DEMO 7788",
      circumscriptionCode: "confluencia",
      actionType: "public",
      represents: "defence",
      reserved: false,
    });
  });

  it("lets only the owner or the responsible change the reserved flag", async () => {
    signedIn({ ...DEMO_ME, id: LAWYER_PAULA.id, role: "LAWYER" }, caseRoutes());
    renderApp(`/causas/${DETAIL_MODELO.id}`);
    const dialog = await openDialog("Editá la causa", "Editá la causa", "Carátula");

    expect(within(dialog).getByRole("checkbox", { name: "Causa reservada" })).toBeDisabled();
    expect(dialog).toHaveTextContent(
      "Solo la persona titular o quien es responsable de la causa cambian la reserva.",
    );
  });

  it("offers no change on an archived case", async () => {
    signedIn(undefined, caseRoutes());
    renderApp(`/causas/${ARCHIVED_DETAIL.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: ARCHIVED_DETAIL.caption }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editá la causa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregá un imputado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva audiencia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editá a / })).not.toBeInTheDocument();
  });

  it("adds a defendant found by name, with the default stage and the firm as defence", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/persons": () =>
        json(200, { items: [PERSON_JULIAN], page: 0, size: 8, total: 1 }),
      [`POST /api/v1/cases/${DETAIL_MODELO.id}/defendants`]: () => json(201, {}),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);
    const dialog = await openDialog(
      "Agregá un imputado",
      "Agregá un imputado",
      "Buscá por nombre o documento",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá al imputado" }));
    expect(
      await within(dialog).findByText("Elegí a la persona de la lista, o cargá una nueva."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Buscá por nombre o documento"), {
      target: { value: "Fict" },
    });
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Ficticio, Julián/ }));
    expect(within(dialog).getByText("Ficticio, Julián")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/api/v1/persons")?.query).toMatchObject({
      q: "Fict",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá al imputado" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes(requests)[0]?.body).toEqual({
      personId: PERSON_JULIAN.id,
      stageCode: "averiguacion-preliminar",
      status: "ACTIVE",
      closingOutcomeCode: null,
      chargesFormulatedOn: null,
      defendedByFirm: true,
      defenceCounselKind: "PRIVATE",
      defenceCounselName: null,
      rebellionDeclaredOn: null,
      rebellionLiftedOn: null,
      indigenousPeople: null,
    });
  });

  it("explains in an alert when the person is already a defendant", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/persons": () =>
        json(200, { items: [PERSON_JULIAN], page: 0, size: 8, total: 1 }),
      [`POST /api/v1/cases/${DETAIL_MODELO.id}/defendants`]: () => problem(409, "duplicate-record"),
    });
    renderApp(`/causas/${DETAIL_MODELO.id}`);
    const dialog = await openDialog(
      "Agregá un imputado",
      "Agregá un imputado",
      "Buscá por nombre o documento",
    );
    fireEvent.change(within(dialog).getByLabelText("Buscá por nombre o documento"), {
      target: { value: "99000111" },
    });
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Ficticio, Julián/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá al imputado" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esa persona ya es imputada en esta causa. Editala desde su tarjeta.",
    );
  });

  it("edits a defendant and sends back what the form does not show", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      [`PUT /api/v1/cases/${DETAIL_EJEMPLAR.id}/defendants/${DEFENDANT_NORA.id}`]: () =>
        json(200, DEFENDANT_NORA),
    });
    renderApp(`/causas/${DETAIL_EJEMPLAR.id}`);
    await screen.findByRole("heading", { level: 1, name: DETAIL_EJEMPLAR.caption });
    fireEvent.click(
      within(section("Imputados")).getByRole("button", { name: "Editá a Nora Ficticia" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editá a Nora Ficticia" });
    await within(dialog).findByLabelText("Estado del proceso");

    expect(
      within(dialog).getByRole("checkbox", { name: "Lo defiende el estudio" }),
    ).not.toBeChecked();
    expect(within(dialog).getByLabelText("Tipo de defensa")).toHaveValue("PUBLIC");

    fireEvent.change(within(dialog).getByLabelText("Estado del proceso"), {
      target: { value: "CLOSED" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));
    expect(await within(dialog).findByText("Elegí cómo terminó el proceso.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Cómo terminó"), {
      target: { value: "sobreseimiento" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes(requests)[0]?.body).toEqual({
      stageCode: "cerrada",
      status: "CLOSED",
      closingOutcomeCode: "sobreseimiento",
      chargesFormulatedOn: DEFENDANT_NORA.chargesFormulatedOn,
      defendedByFirm: false,
      defenceCounselKind: "PUBLIC",
      defenceCounselName: "Defensoría Pública ficticia 2",
      rebellionDeclaredOn: "2026-08-01",
      rebellionLiftedOn: null,
      indigenousPeople: null,
    });
  });
});
