import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_ARCHIVED, CASE_EJEMPLAR, CASE_EJEMPLO, CASE_MODELO } from "@/test/case-fixtures";
import { DEMO_ME, personRoutes, signedIn } from "@/test/mock-api";
import {
  CONTACT_LAURA,
  CONTACT_MARTIN,
  PERSON_COMPANY,
  PERSON_JULIAN,
  PERSON_JULIAN_CUIL,
  PERSON_NORA,
} from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

const region = (name: string) => screen.getByRole("region", { name });

describe("PersonDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows every case with the person's role, masking a reserved case they may not see", async () => {
    signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: PERSON_JULIAN.displayName }),
    ).toBeInTheDocument();
    // Under the name and in the data.
    expect(screen.getAllByText("DNI 99000111")).toHaveLength(2);
    expect(screen.getByText("También: El Juli")).toBeInTheDocument();

    const cases = region("Causas y roles");
    expect(cases).toHaveTextContent("Figura en 4 causas.");
    expect(within(cases).getByRole("link", { name: CASE_EJEMPLO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_EJEMPLO.id}`,
    );
    expect(within(cases).getByRole("link", { name: CASE_MODELO.caption })).toBeInTheDocument();
    expect(within(cases).getByText("Imputado/a (causa archivada)")).toBeInTheDocument();
    expect(within(cases).getByRole("link", { name: CASE_ARCHIVED.caption })).toBeInTheDocument();
    // The reserved one: its words, no link and no caption.
    const reserved = within(cases).getByText("Causa reservada");
    expect(reserved.closest("a")).toBeNull();
    expect(within(cases).getAllByRole("link")).toHaveLength(3);

    const data = region("Datos");
    expect(data).toHaveTextContent("Persona humana");
    expect(data).toHaveTextContent("12/04/1991");
    expect(within(data).getByRole("link", { name: "299 555-0101" })).toHaveAttribute(
      "href",
      "tel:2995550101",
    );
  });

  it("links a reserved case when the user may see it", async () => {
    signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_NORA.id}`);

    const cases = await screen.findByRole("region", { name: "Causas y roles" });
    expect(within(cases).getByRole("link", { name: CASE_EJEMPLAR.caption })).toBeInTheDocument();
    expect(within(cases).queryByText("Causa reservada")).toBeNull();
  });

  it("shows the client's consent, the authorized contacts and who else has the document", async () => {
    signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    await screen.findByText("Derivado por otro cliente (ficticio)");
    const client = region("Cliente");
    expect(within(client).getAllByText("05/10/2026")).toHaveLength(2);
    expect(client).toHaveTextContent("Consentimiento de tratamiento de datos");
    expect(client).toHaveTextContent("Ley 25.326");
    expect(client).toHaveTextContent(
      "Para su defensa en las causas del estudio y para avisarle las audiencias.",
    );
    // His CUIL twin: same DNI inside the CUIL.
    expect(
      within(client).getByText("Otra persona del estudio tiene el mismo documento"),
    ).toBeInTheDocument();
    expect(
      within(client).getByRole("link", { name: PERSON_JULIAN_CUIL.displayName }),
    ).toHaveAttribute("href", `/personas/${PERSON_JULIAN_CUIL.id}`);

    const contacts = region("Contactos autorizados");
    const laura = within(contacts).getByRole("article", { name: CONTACT_LAURA.fullName });
    expect(laura).toHaveTextContent("Hermana");
    expect(laura).toHaveTextContent("Se le puede informar");
    expect(laura).toHaveTextContent(CONTACT_LAURA.mayBeTold);
    expect(
      within(contacts).getByRole("article", { name: CONTACT_MARTIN.fullName }),
    ).toHaveTextContent("martin.ejemplo@example.com");
  });

  it("makes a person a client with the consent to process their data", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_NORA.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Registrar como cliente" }));
    const dialog = await screen.findByRole("dialog", { name: "Registrar como cliente" });
    expect(within(dialog).getByLabelText("Llegó al estudio el")).toHaveValue("2026-11-23");

    // Date and scope go together.
    fireEvent.change(within(dialog).getByLabelText("Lo dio el"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los datos de cliente" }));
    expect(
      await within(dialog).findByText("Escribí para qué dio el consentimiento."),
    ).toBeInTheDocument();

    // Not in the future.
    fireEvent.change(within(dialog).getByLabelText("Llegó al estudio el"), {
      target: { value: "2026-11-24" },
    });
    fireEvent.change(within(dialog).getByLabelText("Para qué lo dio"), {
      target: { value: "Para su defensa (ficticio)." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los datos de cliente" }));
    expect(
      await within(dialog).findByText("La fecha de ingreso no puede ser posterior a hoy."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Llegó al estudio el"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los datos de cliente" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const made = requests.find(
      (request) => request.path === `/api/v1/persons/${PERSON_NORA.id}/client`,
    );
    expect(made?.method).toBe("POST");
    expect(made?.body).toEqual({
      intakeDate: "2026-11-20",
      referralSource: null,
      consentGivenOn: "2026-11-20",
      consentScope: "Para su defensa (ficticio).",
      consentDocumentRef: null,
    });
    expect(await screen.findByRole("region", { name: "Contactos autorizados" })).toHaveTextContent(
      "Todavía no hay contactos autorizados.",
    );
  });

  it("adds an authorized contact and says what may be told to them", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Agregá un contacto" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo contacto autorizado" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá el contacto" }));
    expect(await within(dialog).findByText("Escribí el nombre del contacto.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribí qué se le puede informar.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nombre y apellido"), {
      target: { value: "Rosa Inventada" },
    });
    fireEvent.change(within(dialog).getByLabelText("Vínculo"), { target: { value: "Madre" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "rosa@" } });
    fireEvent.change(within(dialog).getByLabelText("Qué se le puede informar"), {
      target: { value: "Fechas de audiencias." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá el contacto" }));
    expect(
      await within(dialog).findByText("Revisá el email: tiene que ser como nombre@ejemplo.com."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá el contacto" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const added = requests.find(
      (request) => request.method === "POST" && request.path.endsWith("/contacts"),
    );
    expect(added?.body).toEqual({
      fullName: "Rosa Inventada",
      relationship: "Madre",
      phone: null,
      email: null,
      mayBeTold: "Fechas de audiencias.",
    });
    expect(await screen.findByRole("article", { name: "Rosa Inventada" })).toHaveTextContent(
      "Fechas de audiencias.",
    );
  });

  it("archives a contact only after confirming", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    const laura = await screen.findByRole("article", { name: CONTACT_LAURA.fullName });
    fireEvent.click(
      within(laura).getByRole("button", { name: `Archivá a ${CONTACT_LAURA.fullName}` }),
    );
    expect(requests.some((request) => request.path.endsWith("/archive"))).toBe(false);
    fireEvent.click(within(laura).getByRole("button", { name: "Sí, archivá el contacto" }));

    await waitFor(() =>
      expect(screen.queryByRole("article", { name: CONTACT_LAURA.fullName })).toBeNull(),
    );
    expect(
      requests.some(
        (request) =>
          request.path ===
          `/api/v1/clients/${PERSON_JULIAN.clientId}/contacts/${CONTACT_LAURA.id}/archive`,
      ),
    ).toBe(true);
  });

  it("lets the owner archive and restore a person, never delete", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_COMPANY.id}`);

    await screen.findByRole("heading", { level: 1, name: PERSON_COMPANY.displayName });
    expect(screen.queryByRole("button", { name: /Eliminá|Borrá/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Archivá la persona" }));

    expect(await screen.findByText("Esta persona está archivada")).toBeInTheDocument();
    expect(requests.some((r) => r.path === `/api/v1/persons/${PERSON_COMPANY.id}/archive`)).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restaurá la persona" }));
    await waitFor(() => expect(screen.queryByText("Esta persona está archivada")).toBeNull());
  });

  it("hides archiving from a paralegal", async () => {
    signedIn({ ...DEMO_ME, role: "PARALEGAL" }, personRoutes({}, { role: "PARALEGAL" }));
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    await screen.findByRole("heading", { level: 1, name: PERSON_JULIAN.displayName });
    await screen.findByRole("region", { name: "Contactos autorizados" });
    expect(screen.queryByRole("button", { name: "Archivá la persona" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archivá la ficha de cliente" })).toBeNull();
    // Editing stays open to every member.
    expect(screen.getByRole("button", { name: "Editá la persona" })).toBeInTheDocument();
  });

  it("says when the person does not exist", async () => {
    signedIn(undefined, personRoutes());
    renderApp("/personas/00000000-0000-4000-8000-000000000999");

    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos a esta persona" }),
    ).toBeInTheDocument();
  });

  it("does not even ask for an id that cannot be a person", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp("/personas/no-es-un-id");

    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos a esta persona" }),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path.includes("no-es-un-id"))).toBe(false);
  });
});
