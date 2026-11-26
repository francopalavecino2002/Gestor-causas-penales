import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { json, personRoutes, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import {
  CONFLICT_DISCLAIMER,
  PERSON_ARCHIVED,
  PERSON_COMPANY,
  PERSON_JULIAN,
  PERSON_JULIAN_CUIL,
} from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

const listRequests = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method === "GET" && request.path === "/api/v1/persons")
    .map((request) => request.query);

// Cards and the table render together in jsdom (CSS hides one): read the cards.
const cards = () => within(screen.getByRole("list", { name: "Personas" }));

describe("PersonsPage", () => {
  it("lists the firm's persons with their document and their roles in cases", async () => {
    const requests = signedIn(undefined, personRoutes());
    renderApp("/personas");

    expect(await screen.findByRole("heading", { level: 1, name: "Personas" })).toBeInTheDocument();
    expect(await screen.findByText("4 personas en el estudio.")).toBeInTheDocument();
    expect(listRequests(requests)[0]).toEqual({ includeArchived: "false", page: "0", size: "20" });

    const julian = cards().getByRole("article", { name: PERSON_JULIAN.displayName });
    expect(within(julian).getByRole("link", { name: PERSON_JULIAN.displayName })).toHaveAttribute(
      "href",
      `/personas/${PERSON_JULIAN.id}`,
    );
    expect(julian).toHaveTextContent("DNI 99000111");
    expect(within(julian).getByText("Cliente")).toBeInTheDocument();
    // Two roles in words, the rest as a count: a reserved case is never named.
    expect(julian).toHaveTextContent("Imputado/a en Ejemplo, Lucas s/ robo agravado");
    expect(julian).toHaveTextContent("y 2 causas más");

    const company = cards().getByRole("article", { name: PERSON_COMPANY.displayName });
    expect(within(company).getByText("Persona jurídica")).toBeInTheDocument();
    expect(company).toHaveTextContent("CUIT 30990003331");
    // The archived person is left out unless asked for.
    expect(screen.queryByText(PERSON_ARCHIVED.displayName)).toBeNull();
  });

  it("says a reserved case is reserved, without its caption", async () => {
    signedIn(
      undefined,
      personRoutes({
        persons: [
          {
            ...PERSON_JULIAN,
            caseRoles: PERSON_JULIAN.caseRoles.filter((role) => role.caseId === null),
          },
        ],
      }),
    );
    renderApp("/personas");

    const julian = await screen.findByRole("article", { name: PERSON_JULIAN.displayName });
    expect(julian).toHaveTextContent("Testigo en una causa reservada");
  });

  it("searches as you type and keeps the search in the URL", async () => {
    const requests = signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas");
    await screen.findByText("4 personas en el estudio.");

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscá por nombre o documento" }), {
      target: { value: "julián" },
    });

    await waitFor(() => expect(router.state.location.search).toEqual({ q: "julián" }));
    expect(await screen.findByText("2 personas para «julián».")).toBeInTheDocument();
    expect(listRequests(requests).at(-1)).toEqual({
      q: "julián",
      includeArchived: "false",
      page: "0",
      size: "20",
    });
    expect(cards().getByRole("article", { name: PERSON_JULIAN_CUIL.displayName })).toBeVisible();
  });

  it("searches a document number without ever putting it in the URL or the history", async () => {
    const requests = signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas?q=Ficticio");
    await screen.findByText("2 personas para «Ficticio».");
    const visited: string[] = [router.history.location.href];
    const stop = router.history.subscribe(() => visited.push(router.history.location.href));

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscá por nombre o documento" }), {
      target: { value: "99.000.111" },
    });

    // Julián, and his CUIL twin whose number contains the DNI.
    expect(await screen.findByText("2 personas para «99.000.111».")).toBeInTheDocument();
    expect(cards().getByRole("article", { name: PERSON_JULIAN.displayName })).toBeVisible();
    expect(listRequests(requests).at(-1)?.q).toBe("99.000.111");
    // The name search left the URL too, so the page shows only what was searched last.
    expect(router.state.location.search).toEqual({});
    expect(screen.getByRole("searchbox", { name: "Buscá por nombre o documento" })).toHaveValue(
      "99.000.111",
    );

    // The switch keeps the search in memory, still out of the URL.
    fireEvent.click(screen.getByRole("switch", { name: "Incluí las archivadas" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ archivadas: "si" }));
    await waitFor(() => expect(listRequests(requests).at(-1)?.includeArchived).toBe("true"));
    expect(listRequests(requests).at(-1)?.q).toBe("99.000.111");

    stop();
    for (const href of [...visited, router.state.location.href]) {
      expect(href).not.toMatch(/99\.?000\.?111/);
    }
  });

  it("drops a document number that arrives in a link", async () => {
    const requests = signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas?q=99000111");

    expect(await screen.findByText("4 personas en el estudio.")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
    expect(listRequests(requests).every((query) => query.q === undefined)).toBe(true);
  });

  it("includes the archived persons with the switch", async () => {
    signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas");
    await screen.findByText("4 personas en el estudio.");

    fireEvent.click(screen.getByRole("switch", { name: "Incluí las archivadas" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ archivadas: "si" }));
    const archived = await screen.findByRole("article", { name: PERSON_ARCHIVED.displayName });
    expect(within(archived).getByText("Archivada")).toBeInTheDocument();
  });

  it("offers to load a person when a search finds nobody", async () => {
    signedIn(undefined, personRoutes());
    renderApp("/personas?q=inexistente");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No encontramos personas con «inexistente»",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cargá una persona nueva" }));
    expect(await screen.findByRole("dialog", { name: "Nueva persona" })).toBeInTheDocument();
  });

  it("invites to load the first person when there are none", async () => {
    signedIn(undefined, personRoutes({ persons: [], clients: [] }));
    renderApp("/personas");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Todavía no hay personas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargá la primera persona" })).toBeInTheDocument();
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/persons": () =>
        fail ? problem(500, "internal") : json(200, { items: [], page: 0, size: 20, total: 0 }),
    });
    renderApp("/personas");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar las personas");
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Todavía no hay personas" }),
    ).toBeInTheDocument();
  });

  it("runs the conflict check in a POST body, never in the URL", async () => {
    const requests = signedIn(undefined, personRoutes());
    const { router } = renderApp("/personas");
    await screen.findByText("4 personas en el estudio.");

    fireEvent.click(screen.getByRole("button", { name: "Control de conflicto" }));
    const dialog = await screen.findByRole("dialog", { name: "Control de conflicto" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscá el documento" }));
    expect(await within(dialog).findByText("Escribí el número de documento.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "99.000.111" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscá el documento" }));

    expect(
      await within(dialog).findByText("Ya hay 2 personas con este documento"),
    ).toBeInTheDocument();
    const check = requests.find((request) => request.path === "/api/v1/persons/conflict-check");
    expect(check?.method).toBe("POST");
    expect(check?.body).toEqual({ documentNumber: "99000111" });
    expect(requests.every((request) => !request.path.includes("99000111"))).toBe(true);
    expect(requests.every((request) => !Object.values(request.query).includes("99000111"))).toBe(
      true,
    );
    expect(router.state.location.href).not.toContain("99000111");

    // Who they are, whether they are a client and their roles; then the disclaimer, verbatim.
    const julian = within(dialog).getByRole("article", { name: PERSON_JULIAN.displayName });
    expect(within(julian).getByText("Cliente")).toBeInTheDocument();
    expect(within(julian).getByText("Causa reservada")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("article", { name: PERSON_JULIAN_CUIL.displayName }),
    ).toHaveTextContent("Víctima");
    expect(within(dialog).getByText(CONFLICT_DISCLAIMER)).toBeInTheDocument();
  });

  it("says when nobody has the document", async () => {
    signedIn(undefined, personRoutes());
    renderApp("/personas");
    fireEvent.click(await screen.findByRole("button", { name: "Control de conflicto" }));
    const dialog = await screen.findByRole("dialog", { name: "Control de conflicto" });

    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "99000999" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscá el documento" }));

    expect(
      await within(dialog).findByText("No hay otras personas con este documento"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(CONFLICT_DISCLAIMER)).toBeInTheDocument();
  });
});
