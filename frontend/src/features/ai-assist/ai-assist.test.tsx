import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiAssistStatus, HearingDraft } from "@/features/ai-assist/ai-assist-api";
import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_MODELO } from "@/test/case-fixtures";
import {
  caseRoutes,
  DEMO_ME,
  json,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const ON: AiAssistStatus = { available: true, enabled: true, provider: "Google Gemini" };
const OFF: AiAssistStatus = { ...ON, enabled: false };

const DRAFT: HearingDraft = {
  typeCode: "formulacion-de-cargos",
  date: "2026-12-02",
  time: "10:15",
  durationMinutes: null,
  room: "Sala 4 (ficticia)",
  judge: null,
  ofijuReference: "OFIJU-0000/2026 (ficticia)",
  missing: ["judge"],
};

const NOTIFICATION =
  "Se fija audiencia de formulación de cargos el 02/12/2026 10:15, Sala 4. Ficticio.";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

async function openWithModelo() {
  const [button] = await screen.findAllByRole("button", { name: "Cargá una audiencia" });
  fireEvent.click(button!);
  const dialog = await screen.findByRole("dialog", { name: "Nueva audiencia" });
  await within(dialog).findByLabelText("Tipo de audiencia");
  fireEvent.change(within(dialog).getByLabelText("Buscá la causa"), {
    target: { value: "Modelo" },
  });
  fireEvent.click(
    await within(dialog).findByRole("radio", { name: new RegExp(CASE_MODELO.caption) }),
  );
  return dialog;
}

describe("AI assistance: hearing from a notification", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not offered while the firm has it off", async () => {
    signedIn(undefined, caseRoutes());
    renderApp("/");
    const dialog = await openWithModelo();

    await within(dialog).findByRole("button", { name: "Cambiá la causa" });
    await waitFor(() =>
      expect(within(dialog).getByRole("checkbox", { name: /Lucía Ejemplo/ })).toBeChecked(),
    );
    expect(within(dialog).queryByText("Completá desde una notificación")).not.toBeInTheDocument();
  });

  it("fills the form from the pasted text and asks to review it; nothing is saved", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/ai-assist": () => json(200, ON),
      [`POST /api/v1/cases/${CASE_MODELO.id}/hearing-drafts`]: () => json(200, DRAFT),
    });
    renderApp("/");
    const dialog = await openWithModelo();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Pegá una notificación" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Completá con IA" }));
    expect(within(dialog).getByText("Pegá el texto de la notificación.")).toBeInTheDocument();
    expect(writes(requests)).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText("Texto de la notificación"), {
      target: { value: NOTIFICATION },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Completá con IA" }));

    expect(
      await within(dialog).findByText("Revisá cada dato antes de guardar: la IA puede equivocarse"),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent("No encontramos el juez o jueza: cargalo a mano.");
    expect(within(dialog).getByLabelText("Tipo de audiencia")).toHaveValue("formulacion-de-cargos");
    expect(within(dialog).getByLabelText("Día")).toHaveValue("2026-12-02");
    expect(within(dialog).getByLabelText("Hora")).toHaveValue("10:15");
    expect(within(dialog).getByLabelText("Sala")).toHaveValue("Sala 4 (ficticia)");
    expect(within(dialog).getByLabelText("Referencia de la OFIJU")).toHaveValue(
      "OFIJU-0000/2026 (ficticia)",
    );
    expect(writes(requests)).toEqual([
      expect.objectContaining({
        path: `/api/v1/cases/${CASE_MODELO.id}/hearing-drafts`,
        body: { text: NOTIFICATION },
      }),
    ]);
  });

  it("explains a busy provider in plain words and leaves the form as it was", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/ai-assist": () => json(200, ON),
      [`POST /api/v1/cases/${CASE_MODELO.id}/hearing-drafts`]: () =>
        problem(503, "ai-provider-busy"),
    });
    renderApp("/");
    const dialog = await openWithModelo();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Pegá una notificación" }));
    fireEvent.change(within(dialog).getByLabelText("Texto de la notificación"), {
      target: { value: NOTIFICATION },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Completá con IA" }));

    expect(
      await within(dialog).findByText(/El servicio de IA está ocupado. Esperá un minuto/),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tipo de audiencia")).toHaveValue("");
  });
});

describe("settings: AI assistance", () => {
  it("lets the owner turn it on, with the rules and the fictitious-data warning", async () => {
    let status = OFF;
    const requests = signedIn(undefined, {
      "GET /api/v1/ai-assist": () => json(200, status),
      "PUT /api/v1/ai-assist": ({ body }) => {
        status = { ...status, enabled: (body as { enabled: boolean }).enabled };
        return json(200, status);
      },
    });
    renderApp("/ajustes/ia");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Asistente de IA" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Desactivado")).toBeInTheDocument();
    expect(
      screen.getByText("Nunca guarda nada sola: vos revisás cada dato y guardás."),
    ).toBeInTheDocument();
    expect(screen.getByText("Solo con datos ficticios por ahora")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Activado en el estudio" }));

    expect(
      await screen.findByText("Guardado: el asistente de IA está activado."),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Activado en el estudio" })).toBeChecked();
    expect(writes(requests)).toEqual([
      expect.objectContaining({ path: "/api/v1/ai-assist", body: { enabled: true } }),
    ]);
  });

  it("shows it read only to other roles", async () => {
    signedIn({ ...DEMO_ME, role: "LAWYER" }, { "GET /api/v1/ai-assist": () => json(200, OFF) });
    renderApp("/ajustes/ia");

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Activado en el estudio" })).toBeDisabled(),
    );
    expect(
      screen.getByText(/Solo la persona titular del estudio puede cambiarla/),
    ).toBeInTheDocument();
  });

  it("says plainly when the installation has no provider", async () => {
    signedIn(undefined, {
      "GET /api/v1/ai-assist": () => json(200, { ...OFF, available: false }),
    });
    renderApp("/ajustes/ia");

    expect(await screen.findByText("No disponible")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
