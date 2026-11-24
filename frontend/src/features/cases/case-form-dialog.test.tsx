import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DETAIL_MODELO } from "@/test/case-fixtures";
import { PERSON_JULIAN } from "@/test/form-fixtures";
import {
  caseRoutes,
  DEMO_ME,
  json,
  problem,
  problemWith,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const NEW_ID = "00000000-0000-4000-a000-000000000777";
const created = { ...DETAIL_MODELO, id: NEW_ID, caption: "Prueba, Lisandro s/ hurto" };

async function openNewCase() {
  fireEvent.click(await screen.findByRole("button", { name: "Nueva causa" }));
  const dialog = await screen.findByRole("dialog", { name: "Nueva causa" });
  // The fields appear once the catalogs are in.
  await within(dialog).findByLabelText("Carátula");
  return dialog;
}

function fill(dialog: HTMLElement, label: string, value: string) {
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
}

describe("Nueva causa", () => {
  it("validates on the client, offers only visible circumscriptions with their tags, and opens the new case", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      "POST /api/v1/cases": () => json(201, created),
      [`GET /api/v1/cases/${NEW_ID}`]: () => json(200, created),
      [`GET /api/v1/cases/${NEW_ID}/hearings`]: () => json(200, []),
      [`GET /api/v1/cases/${NEW_ID}/deadlines`]: () => json(200, []),
    });
    const { router } = renderApp("/causas");
    const dialog = await openNewCase();

    const circumscription = await within(dialog).findByLabelText("Circunscripción");
    const options = within(circumscription)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Elegí la circunscripción",
      "I Circunscripción, Confluencia",
      "II Circunscripción (de la Comarca) [validar]",
    ]);
    expect(dialog).toHaveTextContent("Formato a confirmar [validar].");

    fill(dialog, "Legajo del MPF", "12345");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));
    expect(await within(dialog).findByText("Escribí la carátula.")).toBeInTheDocument();
    expect(within(dialog).getByText("Elegí la circunscripción.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Escribilo como figura en el legajo, por ejemplo MPFNQ 12345/2026."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Carátula")).toHaveAttribute("aria-invalid", "true");
    expect(writes(requests)).toHaveLength(0);

    fill(dialog, "Carátula", "  Prueba, Lisandro s/ hurto ");
    fill(dialog, "Legajo del MPF", "mpfnq 4321/2026");
    fill(dialog, "Número de la OFIJU", "OFI-DEMO 1/2026");
    fireEvent.change(circumscription, { target: { value: "ii-comarca" } });
    fireEvent.change(within(dialog).getByLabelText("Tipo de acción"), {
      target: { value: "private" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Querella" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Causa reservada" }));
    fireEvent.change(within(dialog).getByLabelText("Responsable de la causa"), {
      target: { value: "00000000-0000-4000-8000-000000000002" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/causas/${NEW_ID}`));
    expect(writes(requests)).toHaveLength(1);
    expect(writes(requests)[0]?.body).toEqual({
      caption: "Prueba, Lisandro s/ hurto",
      internalNumber: null,
      mpfLegajo: "mpfnq 4321/2026",
      ofijuNumber: "OFI-DEMO 1/2026",
      pehuenNumber: null,
      circumscriptionCode: "ii-comarca",
      actionType: "private",
      represents: "private-prosecution",
      reserved: true,
      responsibleUserId: "00000000-0000-4000-8000-000000000002",
      practiceArea: "penal",
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Prueba, Lisandro s/ hurto" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates the new person, then the case, then its first defendant", async () => {
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      "POST /api/v1/persons": () => json(201, PERSON_JULIAN),
      "POST /api/v1/cases": () => json(201, created),
      [`POST /api/v1/cases/${NEW_ID}/defendants`]: () => json(201, {}),
      [`GET /api/v1/cases/${NEW_ID}`]: () => json(200, created),
      [`GET /api/v1/cases/${NEW_ID}/hearings`]: () => json(200, []),
      [`GET /api/v1/cases/${NEW_ID}/deadlines`]: () => json(200, []),
    });
    const { router } = renderApp("/causas");
    const dialog = await openNewCase();

    fill(dialog, "Carátula", "Prueba, Lisandro s/ hurto");
    fireEvent.change(await within(dialog).findByLabelText("Circunscripción"), {
      target: { value: "confluencia" },
    });
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: "Agregá ahora al primer imputado" }),
    );
    fireEvent.click(await within(dialog).findByRole("radio", { name: "Es una persona nueva" }));
    fill(dialog, "Número de documento", "1.234");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));
    expect(await within(dialog).findByText("Escribí el apellido.")).toBeInTheDocument();
    expect(within(dialog).getByText("El DNI tiene 7 u 8 números.")).toBeInTheDocument();

    fill(dialog, "Apellidos", "Ficticio");
    fill(dialog, "Nombres", "Julián");
    fill(dialog, "Número de documento", "99.000.111");
    fireEvent.change(within(dialog).getByLabelText("Etapa"), {
      target: { value: "investigacion-preparatoria" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/causas/${NEW_ID}`));
    const [person, caseFile, defendant] = writes(requests);
    expect(person?.path).toBe("/api/v1/persons");
    expect(person?.body).toEqual({
      kind: "HUMAN",
      firstNames: "Julián",
      lastNames: "Ficticio",
      documentType: "DNI",
      documentNumber: "99000111",
    });
    expect(caseFile?.path).toBe("/api/v1/cases");
    expect(caseFile?.body).toMatchObject({ responsibleUserId: null });
    expect(defendant?.path).toBe(`/api/v1/cases/${NEW_ID}/defendants`);
    expect(defendant?.body).toMatchObject({
      personId: PERSON_JULIAN.id,
      stageCode: "investigacion-preparatoria",
      status: "ACTIVE",
      defendedByFirm: true,
    });
  });

  it("shows server errors on their field, and the rest in an alert", async () => {
    let answer = () => problemWith(409, "case-duplicate-legajo", { detail: "duplicated" });
    const requests = signedIn(undefined, {
      ...caseRoutes(),
      "POST /api/v1/cases": () => answer(),
    });
    renderApp("/causas");
    const dialog = await openNewCase();

    fill(dialog, "Carátula", "Prueba, Lisandro s/ hurto");
    fill(dialog, "Legajo del MPF", "MPFNQ 10234/2026");
    fireEvent.change(await within(dialog).findByLabelText("Circunscripción"), {
      target: { value: "confluencia" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));

    expect(
      await within(dialog).findByText(
        "Ya hay otra causa con este legajo del MPF. Buscala en la lista de causas.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Legajo del MPF")).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByLabelText("Legajo del MPF")).toHaveFocus();

    answer = () => problem(500, "internal");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El servidor no respondió como esperábamos y no se guardó la causa.",
    );
    expect(writes(requests)).toHaveLength(2);
  });

  it("asks a paralegal to choose the responsible lawyer, among owners and lawyers only", async () => {
    signedIn(
      { ...DEMO_ME, id: "00000000-0000-4000-8000-000000000004", role: "PARALEGAL" },
      caseRoutes(),
    );
    renderApp("/causas");
    const dialog = await openNewCase();

    const responsible = within(dialog).getByLabelText("Responsable de la causa");
    await waitFor(() => expect(within(responsible).getAllByRole("option")).toHaveLength(4));
    expect(
      within(responsible)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Elegí a la persona responsable", "Hugo Prueba", "Lucía Ejemplo", "Paula Demo"]);
    fill(dialog, "Carátula", "Prueba s/ daño");
    fireEvent.change(within(dialog).getByLabelText("Circunscripción"), {
      target: { value: "confluencia" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la causa" }));
    expect(
      await within(dialog).findByText(
        "Elegí quién es responsable de la causa: tiene que ser titular o abogado/a.",
      ),
    ).toBeInTheDocument();
  });
});
