import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { personRoutes, signedIn } from "@/test/mock-api";
import { CLIENT_JULIAN, CONTACT_LAURA, PERSON_JULIAN } from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

const save = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Guardá el contacto" }));

const change = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

describe("ContactFormDialog", () => {
  it("needs a name and what may be told to the contact", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Agregá un contacto" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo contacto autorizado" });
    // Blank text does not count.
    change(dialog, "Nombre y apellido", "   ");
    save(dialog);

    expect(await within(dialog).findByText("Escribí el nombre del contacto.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribí qué se le puede informar.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nombre y apellido")).toHaveFocus();
    expect(requests.some((request) => request.path.endsWith("/contacts"))).toBe(false);
  });

  it("creates a contact", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Agregá un contacto" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo contacto autorizado" });
    change(dialog, "Nombre y apellido", "Rosa Inventada");
    change(dialog, "Teléfono", "299 555-0177");
    change(dialog, "Qué se le puede informar", "Fechas de audiencias.");
    save(dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const added = requests.find(
      (request) =>
        request.method === "POST" &&
        request.path === `/api/v1/clients/${CLIENT_JULIAN.id}/contacts`,
    );
    expect(added?.body).toEqual({
      fullName: "Rosa Inventada",
      relationship: null,
      phone: "299 555-0177",
      email: null,
      mayBeTold: "Fechas de audiencias.",
    });
    expect(await screen.findByRole("article", { name: "Rosa Inventada" })).toBeInTheDocument();
  });

  it("edits a contact", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp(`/personas/${PERSON_JULIAN.id}`);

    fireEvent.click(
      await screen.findByRole("button", { name: `Editá a ${CONTACT_LAURA.fullName}` }),
    );
    const dialog = await screen.findByRole("dialog", { name: `Editá a ${CONTACT_LAURA.fullName}` });
    expect(within(dialog).getByLabelText("Vínculo")).toHaveValue("Hermana");
    change(dialog, "Qué se le puede informar", "Solo si sigue en libertad.");
    save(dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const updated = requests.find((request) => request.method === "PUT");
    expect(updated?.path).toBe(`/api/v1/clients/${CLIENT_JULIAN.id}/contacts/${CONTACT_LAURA.id}`);
    expect(updated?.body).toEqual({
      fullName: CONTACT_LAURA.fullName,
      relationship: "Hermana",
      phone: CONTACT_LAURA.phone,
      email: null,
      mayBeTold: "Solo si sigue en libertad.",
    });
    expect(await screen.findByRole("article", { name: CONTACT_LAURA.fullName })).toHaveTextContent(
      "Solo si sigue en libertad.",
    );
  });
});
