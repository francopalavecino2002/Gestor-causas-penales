import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HearingDetail } from "@/features/hearings/hearing-api";
import { FIXTURE_NOW, LAWYER_LUCIA } from "@/test/agenda-fixtures";
import {
  CASE_EJEMPLAR,
  CASE_MODELO,
  DEFENDANT_CARLA,
  HEARINGS_BY_CASE,
} from "@/test/case-fixtures";
import { MEMBERS } from "@/test/form-fixtures";
import { caseRoutes, json, problemWith, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const REVIEW = HEARINGS_BY_CASE[CASE_MODELO.id]![0]!;
const REVIEW_DETAIL: HearingDetail = {
  ...REVIEW,
  room: "Sala 3 (ficticia)",
  requestedBy: "PROSECUTION",
  clashes: [],
};

function savedHearing(overrides: Partial<HearingDetail> = {}): HearingDetail {
  return {
    ...REVIEW_DETAIL,
    id: "00000000-0000-4000-9000-000000000999",
    typeCode: "formulacion-de-cargos",
    typeName: "Formulación de cargos",
    typeArticle: "133",
    startsAt: "2026-11-23T12:30:00Z",
    ...overrides,
  };
}

async function openFromAgenda() {
  // The header button, the floating one and the empty agenda's: any of them opens the form.
  const [button] = await screen.findAllByRole("button", { name: "Cargá una audiencia" });
  fireEvent.click(button!);
  const dialog = await screen.findByRole("dialog", { name: "Nueva audiencia" });
  await within(dialog).findByLabelText("Tipo de audiencia");
  return dialog;
}

async function chooseModelo(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("Buscá la causa"), {
    target: { value: "Modelo" },
  });
  fireEvent.click(
    await within(dialog).findByRole("radio", { name: new RegExp(CASE_MODELO.caption) }),
  );
  // The case's responsible goes and its only open defendant is called, once the case loads.
  await waitFor(() =>
    expect(within(dialog).getByRole("checkbox", { name: /Lucía Ejemplo/ })).toBeChecked(),
  );
}

describe("hearing form", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a hearing from the agenda: case by search, type with its article, Neuquén time", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      [`POST /api/v1/cases/${CASE_MODELO.id}/hearings`]: () => json(201, savedHearing()),
    });
    renderApp("/");
    const dialog = await openFromAgenda();

    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la audiencia" }));
    expect(await within(dialog).findByText("Elegí la causa de la audiencia.")).toBeInTheDocument();
    expect(within(dialog).getByText("Elegí el tipo de audiencia.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribí la hora, por ejemplo 09:30.")).toBeInTheDocument();
    expect(writes(requests)).toHaveLength(0);

    await chooseModelo(dialog);
    expect(within(dialog).getByRole("button", { name: "Cambiá la causa" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`Causa elegida: ${CASE_MODELO.caption}`);
    expect(
      within(dialog).getByRole("checkbox", { name: DEFENDANT_CARLA.displayName }),
    ).toBeChecked();

    const type = within(dialog).getByLabelText("Tipo de audiencia");
    expect(
      within(type).getByRole("option", { name: "Formulación de cargos (CPP art. 133)" }),
    ).toBeInTheDocument();
    fireEvent.change(type, { target: { value: "formulacion-de-cargos" } });
    expect(within(dialog).getByText("CPP art. 133")).toBeInTheDocument();
    // The agenda's day comes prefilled.
    expect(within(dialog).getByLabelText("Día")).toHaveValue("2026-11-23");
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "09:30" } });
    fireEvent.change(within(dialog).getByLabelText("Duración"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Sala"), {
      target: { value: "Sala 2 (ficticia)" },
    });
    fireEvent.change(within(dialog).getByLabelText("Estado"), { target: { value: "solicitada" } });
    expect(within(dialog).queryByLabelText("Motivo")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Paula Demo/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la audiencia" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [post] = writes(requests);
    expect(post?.path).toBe(`/api/v1/cases/${CASE_MODELO.id}/hearings`);
    expect(post?.body).toEqual({
      typeCode: "formulacion-de-cargos",
      startsAt: "2026-11-23T12:30:00.000Z",
      durationMinutes: 90,
      room: "Sala 2 (ficticia)",
      judge: null,
      ofijuReference: null,
      requestedBy: null,
      statusCode: "solicitada",
      cancellationReasonCode: null,
      heldAsTypeCode: null,
      resultSummary: null,
      notes: null,
      defendantIds: [DEFENDANT_CARLA.id],
      lawyerIds: [LAWYER_LUCIA.id, "00000000-0000-4000-8000-000000000002"],
    });
    // The agenda reloads to show it.
    await waitFor(() =>
      expect(
        requests.filter((request) => request.path === "/api/v1/agenda").length,
      ).toBeGreaterThan(1),
    );
  });

  it("warns about a schedule clash after saving, without blocking", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      [`POST /api/v1/cases/${CASE_MODELO.id}/hearings`]: () =>
        json(
          201,
          savedHearing({
            clashes: [
              {
                hearingId: "00000000-0000-4000-9000-000000000004",
                userId: LAWYER_LUCIA.id,
                startsAt: "2026-11-23T12:00:00Z",
                caseId: CASE_EJEMPLAR.id,
                caseCaption: CASE_EJEMPLAR.caption,
                reserved: false,
              },
              {
                hearingId: "00000000-0000-4000-9000-000000000005",
                userId: LAWYER_LUCIA.id,
                startsAt: "2026-11-23T12:45:00Z",
                caseId: null,
                caseCaption: null,
                reserved: true,
              },
            ],
          }),
        ),
    });
    renderApp("/");
    const dialog = await openFromAgenda();
    await chooseModelo(dialog);
    fireEvent.change(within(dialog).getByLabelText("Tipo de audiencia"), {
      target: { value: "formulacion-de-cargos" },
    });
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "09:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la audiencia" }));

    const warning = await screen.findByRole("dialog", { name: "La audiencia se guardó" });
    const alert = within(warning).getByRole("alert");
    expect(alert).toHaveTextContent("Se superpone con otra audiencia");
    expect(alert).toHaveTextContent(
      `Lucía Ejemplo tiene la audiencia de «${CASE_EJEMPLAR.caption}» el lunes 23 de noviembre de 2026, 09:00.`,
    );
    expect(alert).toHaveTextContent(
      "Lucía Ejemplo tiene otra audiencia de una causa reservada el lunes 23 de noviembre de 2026, 09:45.",
    );
    fireEvent.click(within(warning).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("maps a server error about the lawyers onto their field", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      [`POST /api/v1/cases/${CASE_MODELO.id}/hearings`]: () =>
        problemWith(400, "invalid-hearing-data", {
          detail: "An archived user cannot attend a hearing",
        }),
    });
    renderApp("/");
    const dialog = await openFromAgenda();
    await chooseModelo(dialog);
    fireEvent.change(within(dialog).getByLabelText("Tipo de audiencia"), {
      target: { value: "formulacion-de-cargos" },
    });
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "09:30" } });

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Lucía Ejemplo/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la audiencia" }));
    expect(
      await within(dialog).findByText("Elegí al menos a una persona del estudio que vaya."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Hugo Prueba/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la audiencia" }));
    expect(
      await within(dialog).findByText(
        "Una de las personas elegidas ya no tiene la cuenta activa. Sacala de la lista.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("edits a hearing of the case and reschedules it when the time changes", async () => {
    const moved = savedHearing({ id: REVIEW.id, statusCode: "reprogramada" });
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/hearings/${REVIEW.id}`]: () => json(200, REVIEW_DETAIL),
      [`PUT /api/v1/hearings/${REVIEW.id}`]: () => json(200, REVIEW_DETAIL),
      [`POST /api/v1/hearings/${REVIEW.id}/reschedule`]: () => json(200, moved),
    });
    renderApp(`/causas/${CASE_MODELO.id}`);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Editá la audiencia Revisión de prisión preventiva",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editá la audiencia" });
    const time = await within(dialog).findByLabelText("Hora");
    expect(time).toHaveValue("11:00");
    expect(within(dialog).getByLabelText("Sala")).toHaveValue("Sala 3 (ficticia)");
    expect(within(dialog).getByLabelText("Quién la pidió")).toHaveValue("PROSECUTION");
    expect(within(dialog).queryByLabelText("Buscá la causa")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Motivo de la reprogramación")).not.toBeInTheDocument();

    fireEvent.change(time, { target: { value: "11:30" } });
    expect(dialog).toHaveTextContent("la audiencia queda «Reprogramada»");
    fireEvent.change(within(dialog).getByLabelText("Motivo de la reprogramación"), {
      target: { value: "Pedido de la fiscalía (ficticio)" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The reschedule goes first, so a refused one saves nothing; the edit then keeps its result.
    const [reschedule, put] = writes(requests);
    expect(reschedule?.path).toBe(`/api/v1/hearings/${REVIEW.id}/reschedule`);
    expect(reschedule?.body).toEqual({
      startsAt: "2026-11-23T14:30:00.000Z",
      reason: "Pedido de la fiscalía (ficticio)",
    });
    expect(put?.path).toBe(`/api/v1/hearings/${REVIEW.id}`);
    expect(put?.body).toMatchObject({
      typeCode: REVIEW.typeCode,
      startsAt: "2026-11-23T14:30:00.000Z",
      statusCode: "reprogramada",
      room: "Sala 3 (ficticia)",
      requestedBy: "PROSECUTION",
      lawyerIds: [LAWYER_LUCIA.id],
    });
  });

  it("does not move the date and change the status in one edit", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/hearings/${REVIEW.id}`]: () => json(200, REVIEW_DETAIL),
    });
    renderApp(`/causas/${CASE_MODELO.id}`);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Editá la audiencia Revisión de prisión preventiva",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editá la audiencia" });
    fireEvent.change(await within(dialog).findByLabelText("Hora"), {
      target: { value: "11:30" },
    });
    fireEvent.change(within(dialog).getByLabelText("Estado"), { target: { value: "efectiva" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));

    expect(
      await within(dialog).findByText(
        /dejá el estado como estaba: la audiencia queda «Reprogramada»/,
      ),
    ).toBeInTheDocument();
    expect(writes(requests)).toHaveLength(0);
  });

  it("says when the firm's members did not load and lets you retry", async () => {
    let failing = true;
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/users": () => (failing ? json(500, {}) : json(200, MEMBERS)),
    });
    renderApp("/");
    const dialog = await openFromAgenda();
    expect(
      await within(dialog).findByText("No pudimos cargar a todas las personas del estudio."),
    ).toBeInTheDocument();
    failing = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Reintentá" }));
    await waitFor(() =>
      expect(
        within(dialog).queryByText("No pudimos cargar a todas las personas del estudio."),
      ).not.toBeInTheDocument(),
    );
    expect(within(dialog).getByRole("checkbox", { name: /Paula Demo/ })).toBeInTheDocument();
  });
});
