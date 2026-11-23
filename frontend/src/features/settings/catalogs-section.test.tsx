import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const row = (name: string) => screen.getByRole("listitem", { name });

describe("settings: catalogs", () => {
  it("lists the items with their article, review tags, renames and hidden ones", async () => {
    signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/catalogos");

    expect(await screen.findByRole("heading", { level: 1, name: "Catálogos" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Catálogo")).toHaveValue("hearing-types");
    expect(
      screen.getByRole("heading", { level: 2, name: "Tipos de audiencia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Podés renombrar y ocultar ítems, y agregar los de tu estudio.", {
        exact: false,
      }),
    ).toBeInTheDocument();

    expect(row("Formulación de cargos")).toHaveTextContent("CPP art. 133");
    expect(row("Control de acusación")).toHaveTextContent("CPP arts. 167 a 169");
    expect(within(row("Control de acusación")).getByText("[no verificado]")).toBeInTheDocument();
    expect(row("Revisión de la preventiva")).toHaveTextContent(
      "Nombre en la norma: Revisión de prisión preventiva",
    );
    const hidden = row("Juicio por jurados");
    expect(within(hidden).getByText("Oculto")).toBeInTheDocument();
    expect(within(hidden).getByText("[validar]")).toBeInTheDocument();
    expect(within(hidden).getByRole("button", { name: "Mostrá" })).toBeInTheDocument();
    expect(
      within(row("Audiencia de prueba anticipada (estudio)")).getByText("Agregado por el estudio"),
    ).toBeInTheDocument();
    expect(screen.getByText("5 ítems, 1 oculto.")).toBeInTheDocument();
  });

  it("hides an item keeping its current name, with the CSRF header", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/catalogos");

    const renamed = await screen.findByRole("listitem", { name: "Revisión de la preventiva" });
    fireEvent.click(within(renamed).getByRole("button", { name: "Ocultá" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Oculto: Revisión de la preventiva.",
    );
    const [put] = writes(requests);
    expect(put?.path).toBe("/api/v1/catalogs/hearing-types/items/revision-de-prision-preventiva");
    expect(put?.body).toEqual({ name: "Revisión de la preventiva", hidden: true });
    expect(put?.headers["x-xsrf-token"]).toBe("token-1");
    await waitFor(() =>
      expect(within(row("Revisión de la preventiva")).getByText("Oculto")).toBeInTheDocument(),
    );
  });

  it("renames an item after validating the name, and can go back to the norm's name", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/catalogos");

    fireEvent.click(
      within(await screen.findByRole("listitem", { name: "Formulación de cargos" })).getByRole(
        "button",
        { name: "Renombrá" },
      ),
    );
    const dialog = await screen.findByRole("dialog", { name: "Renombrá el ítem" });
    expect(dialog).toHaveTextContent("En la norma se llama «Formulación de cargos» (CPP art. 133)");
    const name = within(dialog).getByLabelText("Nombre");
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá" }));
    expect(await within(dialog).findByText("Escribí el nombre.")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(writes(requests)).toHaveLength(0);

    fireEvent.change(name, { target: { value: "Formalización" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Guardado: ahora se llama Formalización.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes(requests)[0]?.body).toEqual({ name: "Formalización", hidden: false });

    fireEvent.click(
      within(await screen.findByRole("listitem", { name: "Formalización" })).getByRole("button", {
        name: "Renombrá",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Volvé al nombre de la norma",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Guardado: ahora se llama Formulación de cargos.",
    );
    expect(writes(requests)[1]?.body).toEqual({ name: null, hidden: false });
  });

  it("adds a firm item with an optional article", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/catalogos");

    fireEvent.click(await screen.findByRole("button", { name: "Agregá un ítem" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregá un ítem" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá el ítem" }));
    expect(await within(dialog).findByText("Escribí el nombre.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nombre"), {
      target: { value: "Audiencia de conciliación (estudio)" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregá el ítem" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Agregado: Audiencia de conciliación (estudio).",
    );
    const [post] = writes(requests);
    expect(post?.path).toBe("/api/v1/catalogs/hearing-types/items");
    expect(post?.body).toEqual({ name: "Audiencia de conciliación (estudio)", article: null });
    expect(
      await screen.findByRole("listitem", { name: "Audiencia de conciliación (estudio)" }),
    ).toBeInTheDocument();
  });

  it("switches catalogs through the URL and only offers what the catalog allows", async () => {
    signedIn(undefined, settingsRoutes().routes);
    const { router } = renderApp("/ajustes/catalogos");

    fireEvent.change(await screen.findByLabelText("Catálogo"), { target: { value: "stages" } });

    await waitFor(() => expect(router.state.location.search).toEqual({ catalogo: "stages" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Etapas del proceso" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No se pueden ocultar ni agregar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregá un ítem" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Renombrá" })).toHaveLength(3);
  });

  it("is read only for a member who is not the owner", async () => {
    signedIn({ ...DEMO_ME, role: "LAWYER" }, settingsRoutes().routes);
    renderApp("/ajustes/catalogos?catalogo=coercive-measures");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Medidas de coerción" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Solo la persona titular del estudio puede cambiarla/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renombrá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultá" })).not.toBeInTheDocument();
  });

  it("says in Spanish why a change was rejected", async () => {
    const { routes } = settingsRoutes();
    signedIn(undefined, {
      ...routes,
      "PUT /api/v1/catalogs/hearing-types/items/formulacion-de-cargos": () =>
        problem(403, "access-denied"),
    });
    renderApp("/ajustes/catalogos");

    fireEvent.click(
      within(await screen.findByRole("listitem", { name: "Formulación de cargos" })).getByRole(
        "button",
        { name: "Ocultá" },
      ),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos guardar el cambio");
    expect(alert).toHaveTextContent("Solo la persona titular del estudio puede hacer este cambio.");
  });
});
