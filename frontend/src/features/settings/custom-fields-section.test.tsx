import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { FIELD_OLD_FILE, FIELD_ORIGIN } from "@/test/settings-fixtures";
import { settingsRoutes } from "@/test/settings-mock";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const section = (name: string) => screen.getByRole("region", { name });
const row = (name: string) => screen.getByRole("listitem", { name });

describe("settings: custom fields", () => {
  it("lists the fields in use and the archived ones, and switches to the defendants' fields", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    const { router } = renderApp("/ajustes/campos");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Campos propios" }),
    ).toBeInTheDocument();
    await screen.findByRole("region", { name: "En uso" });
    const inUse = section("En uso");
    expect(
      within(inUse)
        .getAllByRole("listitem")
        .map((item) => item.querySelector("span")?.textContent),
    ).toEqual(["Juzgado de familia vinculado", "Cómo llegó el cliente"]);
    const origin = row("Cómo llegó el cliente");
    expect(origin).toHaveTextContent("Lista de opciones");
    expect(origin).toHaveTextContent("Obligatorio");
    expect(origin).toHaveTextContent(
      "Opciones: Recomendación, Derivado por la defensoría (ocultas: Sitio web)",
    );
    expect(within(section("Archivados")).getByText(FIELD_OLD_FILE.label)).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/api/v1/custom-fields")?.query).toEqual({
      entity: "CASE_FILE",
      includeArchived: "true",
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "Campos de" })).getByRole("button", {
        name: "Imputados",
      }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({ para: "imputados" }));
    expect(await screen.findByRole("listitem", { name: "Necesita intérprete" })).toHaveTextContent(
      "Sí o no",
    );
    expect(screen.queryByRole("region", { name: "Archivados" })).not.toBeInTheDocument();
    expect(requests.at(-1)?.query.entity).toBe("DEFENDANT");
  });

  it("creates a list field after validating the name and the options", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/campos");

    fireEvent.click(await screen.findByRole("button", { name: "Agregá un campo" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregá un campo a las causas" });
    expect(dialog).toHaveTextContent("No crees campos para datos sensibles");
    expect(dialog).toHaveTextContent("Ley 25.326");

    fireEvent.click(within(dialog).getByRole("radio", { name: /Lista de opciones/ }));
    const first = await within(dialog).findByLabelText("Opción 1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá el campo" }));
    expect(await within(dialog).findByText("Escribí el nombre del campo.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribí el nombre de la opción.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nombre del campo"), {
      target: { value: "Fiscalía interviniente" },
    });
    fireEvent.change(first, { target: { value: "Fiscalía 1 (ficticia)" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá una opción" }));
    fireEvent.change(await within(dialog).findByLabelText("Opción 2"), {
      target: { value: "fiscalía 1 (ficticia)" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá el campo" }));
    expect(
      await within(dialog).findByText("Ya hay una opción con este nombre."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Opción 2"), {
      target: { value: "Fiscalía 2 (ficticia)" },
    });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Es obligatorio completarlo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá el campo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Agregado: Fiscalía interviniente.",
    );
    expect(writes(requests)[0]?.body).toEqual({
      entity: "CASE_FILE",
      label: "Fiscalía interviniente",
      type: "LIST",
      required: true,
      options: [{ label: "Fiscalía 1 (ficticia)" }, { label: "Fiscalía 2 (ficticia)" }],
    });
    expect(
      await screen.findByRole("listitem", { name: "Fiscalía interviniente" }),
    ).toBeInTheDocument();
  });

  it("edits a list field: hides a saved option and adds a new one, keeping codes and position", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/campos");

    fireEvent.click(
      within(await screen.findByRole("listitem", { name: FIELD_ORIGIN.label })).getByRole(
        "button",
        { name: "Editá" },
      ),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editá el campo" });
    expect(dialog).toHaveTextContent("el tipo no se cambia");
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    // Saved options are hidden, never removed.
    expect(
      within(dialog).queryByRole("button", { name: /Quitá la opción/ }),
    ).not.toBeInTheDocument();

    const hiddenBoxes = within(dialog).getAllByRole("checkbox", { name: "Oculta" });
    expect(hiddenBoxes.map((box) => box.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    fireEvent.click(hiddenBoxes[1] as HTMLElement);
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá una opción" }));
    fireEvent.change(await within(dialog).findByLabelText("Opción 4"), {
      target: { value: "Colegio de abogados" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá los cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent(`Guardado: ${FIELD_ORIGIN.label}.`);
    const [put] = writes(requests);
    expect(put?.method).toBe("PUT");
    expect(put?.path).toBe(`/api/v1/custom-fields/${FIELD_ORIGIN.id}`);
    expect(put?.body).toEqual({
      label: FIELD_ORIGIN.label,
      required: true,
      position: 1,
      options: [
        { code: "recomendacion", label: "Recomendación", hidden: false },
        { code: "defensoria", label: "Derivado por la defensoría", hidden: true },
        { code: "web", label: "Sitio web", hidden: true },
        { label: "Colegio de abogados", hidden: false },
      ],
    });
  });

  it("asks before archiving, and restores without deleting anything", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/campos");

    fireEvent.click(
      within(
        await screen.findByRole("listitem", { name: "Juzgado de familia vinculado" }),
      ).getByRole("button", { name: "Archivá" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "¿Archivás el campo Juzgado de familia vinculado?",
    });
    expect(dialog).toHaveTextContent("Los valores que ya se cargaron no se borran");
    fireEvent.click(within(dialog).getByRole("button", { name: "Archivá el campo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Archivado: Juzgado de familia vinculado.",
    );
    await waitFor(() =>
      expect(
        within(section("Archivados")).getByText("Juzgado de familia vinculado"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(within(row(FIELD_OLD_FILE.label)).getByRole("button", { name: "Restaurá" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      `Restaurado: ${FIELD_OLD_FILE.label}.`,
    );
    expect(writes(requests).map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /api/v1/custom-fields/00000000-0000-4000-e000-000000000001/archive",
      `POST /api/v1/custom-fields/${FIELD_OLD_FILE.id}/restore`,
    ]);
    await waitFor(() =>
      expect(within(section("En uso")).getByText(FIELD_OLD_FILE.label)).toBeInTheDocument(),
    );
  });

  it("explains a failed archive in the dialog and a failed restore on the page", async () => {
    const { routes } = settingsRoutes();
    signedIn(undefined, {
      ...routes,
      "POST /api/v1/custom-fields/00000000-0000-4000-e000-000000000001/archive": () =>
        problem(403, "access-denied"),
      [`POST /api/v1/custom-fields/${FIELD_OLD_FILE.id}/restore`]: () =>
        problem(404, "custom-field-not-found"),
    });
    renderApp("/ajustes/campos");

    fireEvent.click(
      within(
        await screen.findByRole("listitem", { name: "Juzgado de familia vinculado" }),
      ).getByRole("button", { name: "Archivá" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Archivá el campo" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Solo la persona titular del estudio puede hacer este cambio.",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(section("En uso")).getByText("Juzgado de familia vinculado")).toBeInTheDocument();

    fireEvent.click(within(row(FIELD_OLD_FILE.label)).getByRole("button", { name: "Restaurá" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos restaurar el campo");
    expect(alert).toHaveTextContent("Ya no encontramos lo que querías cambiar. Recargá la página");
    expect(within(section("Archivados")).getByText(FIELD_OLD_FILE.label)).toBeInTheDocument();
  });

  it("is read only for a member who is not the owner", async () => {
    signedIn({ ...DEMO_ME, role: "PARALEGAL" }, settingsRoutes().routes);
    renderApp("/ajustes/campos");

    await screen.findByRole("region", { name: "En uso" });
    expect(screen.queryByRole("button", { name: "Agregá un campo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restaurá" })).not.toBeInTheDocument();
  });
});
