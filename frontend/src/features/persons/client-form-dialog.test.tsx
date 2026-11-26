import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { personRoutes, problemWith, signedIn } from "@/test/mock-api";
import { CLIENT_JULIAN, PERSON_JULIAN, PERSON_NORA } from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

async function openNewClient() {
  fireEvent.click(await screen.findByRole("button", { name: "Registrar como cliente" }));
  return screen.findByRole("dialog", { name: "Registrar como cliente" });
}

const save = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los datos de cliente" }));

const change = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

describe("ClientFormDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs the day the person came to the firm", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_NORA.id}`);
    const dialog = await openNewClient();

    change(dialog, "Llegó al estudio el", "");
    save(dialog);

    expect(
      await within(dialog).findByText("Elegí la fecha en que llegó al estudio."),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path.endsWith("/client"))).toBe(false);
  });

  it("asks for the consent date and scope together, never in the future", async () => {
    signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_NORA.id}`);
    const dialog = await openNewClient();

    change(dialog, "Para qué lo dio", "Para su defensa (ficticio).");
    save(dialog);
    expect(
      await within(dialog).findByText("Elegí cuándo dio el consentimiento."),
    ).toBeInTheDocument();

    change(dialog, "Para qué lo dio", "");
    change(dialog, "Lo dio el", "2026-11-20");
    save(dialog);
    expect(
      await within(dialog).findByText("Escribí para qué dio el consentimiento."),
    ).toBeInTheDocument();

    change(dialog, "Lo dio el", "2026-11-25");
    change(dialog, "Para qué lo dio", "Para su defensa (ficticio).");
    save(dialog);
    expect(
      await within(dialog).findByText("La fecha del consentimiento no puede ser posterior a hoy."),
    ).toBeInTheDocument();
  });

  it("explains when the person is already a client", async () => {
    signedIn(undefined, {
      ...personRoutes(),
      [`POST /api/v1/persons/${PERSON_NORA.id}/client`]: () =>
        problemWith(409, "already-a-client", { clientId: CLIENT_JULIAN.id }),
    });
    renderApp(`/personas/${PERSON_NORA.id}`);
    const dialog = await openNewClient();

    save(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta persona ya es cliente del estudio.",
    );
    expect(screen.getByRole("dialog", { name: "Registrar como cliente" })).toBeInTheDocument();
  });

  it("edits the client's data with a full replace", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Editá los datos de cliente" }));
    const dialog = await screen.findByRole("dialog", { name: "Editá los datos de cliente" });
    expect(within(dialog).getByLabelText("Llegó al estudio el")).toHaveValue("2026-10-05");
    change(dialog, "Cómo llegó", "Recomendado por un colega (ficticio)");
    save(dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const updated = requests.find((request) => request.method === "PUT");
    expect(updated?.path).toBe(`/api/v1/clients/${CLIENT_JULIAN.id}`);
    expect(updated?.body).toEqual({
      intakeDate: CLIENT_JULIAN.intakeDate,
      referralSource: "Recomendado por un colega (ficticio)",
      consentGivenOn: CLIENT_JULIAN.consentGivenOn,
      consentScope: CLIENT_JULIAN.consentScope,
      consentDocumentRef: CLIENT_JULIAN.consentDocumentRef,
    });
    expect(await screen.findByText("Recomendado por un colega (ficticio)")).toBeInTheDocument();
  });
});
