import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { personRoutes, signedIn } from "@/test/mock-api";
import {
  CONFLICT_DISCLAIMER,
  PERSON_COMPANY,
  PERSON_JULIAN,
  PERSON_JULIAN_CUIL,
} from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

async function openNewPerson() {
  fireEvent.click(await screen.findByRole("button", { name: "Nueva persona" }));
  return screen.findByRole("dialog", { name: "Nueva persona" });
}

const save = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la persona" }));

describe("PersonFormDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a human person and opens their detail", async () => {
    const requests = signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas");
    const dialog = await openNewPerson();

    // The first field has the focus; a human needs a last name.
    expect(within(dialog).getByRole("radio", { name: /Persona humana/ })).toHaveFocus();
    save(dialog);
    expect(await within(dialog).findByText("Escribí el apellido.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Apellidos"), {
      target: { value: "Inventado" },
    });
    fireEvent.change(within(dialog).getByLabelText("Nombres"), { target: { value: "Bruno" } });
    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "12" },
    });
    fireEvent.change(within(dialog).getByLabelText("Fecha de nacimiento"), {
      target: { value: "2027-01-01" },
    });
    save(dialog);
    expect(await within(dialog).findByText("El DNI tiene 7 u 8 números.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("La fecha de nacimiento no puede ser posterior a hoy."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "99.000.555" },
    });
    fireEvent.change(within(dialog).getByLabelText("Fecha de nacimiento"), {
      target: { value: "1988-02-29" },
    });
    save(dialog);

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/personas\/[0-9a-f-]+$/));
    const created = requests.find(
      (request) => request.method === "POST" && request.path === "/api/v1/persons",
    );
    expect(created?.body).toEqual({
      kind: "HUMAN",
      firstNames: "Bruno",
      lastNames: "Inventado",
      legalName: null,
      aliases: null,
      documentType: "DNI",
      documentNumber: "99000555",
      birthDate: "1988-02-29",
      nationality: null,
      phone: null,
      email: null,
      address: null,
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Inventado, Bruno" }),
    ).toBeInTheDocument();
  });

  it("asks a legal entity for its name and sends no human fields", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp("/personas");
    const dialog = await openNewPerson();

    fireEvent.change(within(dialog).getByLabelText("Apellidos"), { target: { value: "Resto" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Persona jurídica/ }));
    expect(within(dialog).queryByLabelText("Apellidos")).toBeNull();
    expect(within(dialog).queryByLabelText("Fecha de nacimiento")).toBeNull();
    save(dialog);
    expect(
      await within(dialog).findByText("Escribí la razón social o el nombre de la entidad."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Razón social"), {
      target: { value: "Ejemplo Seguros S.A. (ficticia)" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tipo de documento"), {
      target: { value: "" },
    });
    save(dialog);

    await screen.findByRole("heading", { level: 1, name: "Ejemplo Seguros S.A. (ficticia)" });
    const created = requests.find(
      (request) => request.method === "POST" && request.path === "/api/v1/persons",
    );
    expect(created?.body).toMatchObject({
      kind: "LEGAL",
      legalName: "Ejemplo Seguros S.A. (ficticia)",
      firstNames: null,
      lastNames: null,
      birthDate: null,
      documentType: null,
      documentNumber: null,
    });
  });

  it("checks the document against the firm when the field is left", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp("/personas");
    const dialog = await openNewPerson();
    const number = within(dialog).getByLabelText("Número de documento");

    fireEvent.change(number, { target: { value: "99000111" } });
    fireEvent.focusOut(number);

    expect(
      await within(dialog).findByText("Ya hay 2 personas con este documento"),
    ).toBeInTheDocument();
    expect(requests.filter((r) => r.path === "/api/v1/persons/conflict-check")).toHaveLength(1);
    expect(requests.find((r) => r.path === "/api/v1/persons/conflict-check")?.body).toEqual({
      documentNumber: "99000111",
    });
    const julian = within(dialog).getByRole("article", { name: PERSON_JULIAN.displayName });
    expect(within(julian).getByText("Cliente")).toBeInTheDocument();
    expect(julian).toHaveTextContent("Imputado/a");
    // Inside the form the names are not links: following one would lose what was typed.
    expect(within(julian).queryByRole("link", { name: PERSON_JULIAN.displayName })).toBeNull();
    expect(
      within(dialog).getByRole("article", { name: PERSON_JULIAN_CUIL.displayName }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(CONFLICT_DISCLAIMER)).toBeInTheDocument();

    // Leaving the field again with the same number does not ask again; a new number does.
    fireEvent.focusOut(number);
    fireEvent.change(number, { target: { value: "99000999" } });
    expect(within(dialog).queryByText("Ya hay 2 personas con este documento")).toBeNull();
    fireEvent.focusOut(number);
    expect(
      await within(dialog).findByText("No hay otras personas con este documento"),
    ).toBeInTheDocument();
    expect(requests.filter((r) => r.path === "/api/v1/persons/conflict-check")).toHaveLength(2);
  });

  it("does not check a number that does not fit its type yet", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp("/personas");
    const dialog = await openNewPerson();
    const number = within(dialog).getByLabelText("Número de documento");

    fireEvent.change(number, { target: { value: "123" } });
    fireEvent.focusOut(number);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests.some((r) => r.path === "/api/v1/persons/conflict-check")).toBe(false);
  });

  it("points to the existing person when the document is already loaded", async () => {
    signedIn(undefined, personRoutes());
    renderApp("/personas");
    const dialog = await openNewPerson();

    fireEvent.change(within(dialog).getByLabelText("Apellidos"), { target: { value: "Copia" } });
    fireEvent.change(within(dialog).getByLabelText("Tipo de documento"), {
      target: { value: "CUIT" },
    });
    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "30-99000333-1" },
    });
    save(dialog);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Ya existe una persona con ese documento");
    expect(
      within(alert).getByRole("link", { name: "Abrí la ficha de esa persona" }),
    ).toHaveAttribute("href", `/personas/${PERSON_COMPANY.id}`);
    expect(within(dialog).getByLabelText("Número de documento")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("edits a person without changing their kind", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Editá la persona" }));
    const dialog = await screen.findByRole("dialog", {
      name: `Editá a ${PERSON_JULIAN.displayName}`,
    });
    expect(within(dialog).queryByRole("radio", { name: /Persona jurídica/ })).toBeNull();
    expect(within(dialog).getByLabelText("Apellidos")).toHaveValue("Ficticio");

    fireEvent.change(within(dialog).getByLabelText("Teléfono"), {
      target: { value: "299 555-0199" },
    });
    save(dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const updated = requests.find((request) => request.method === "PUT");
    expect(updated?.path).toBe(`/api/v1/persons/${PERSON_JULIAN.id}`);
    expect(updated?.body).toMatchObject({
      kind: "HUMAN",
      lastNames: "Ficticio",
      documentType: "DNI",
      documentNumber: "99000111",
      phone: "299 555-0199",
    });
    expect(requests.some((request) => request.path.endsWith("/conflict-check"))).toBe(false);
    expect(await screen.findByRole("link", { name: "299 555-0199" })).toBeInTheDocument();
  });
});
