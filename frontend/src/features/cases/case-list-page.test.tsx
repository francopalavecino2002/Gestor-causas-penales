import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASES, CASE_EJEMPLAR, CASE_MODELO, manyCases } from "@/test/case-fixtures";
import { caseRoutes, json, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const caseRequests = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/cases").map((request) => request.query);

/** The desktop table and the phone cards are both in the DOM; CSS shows one of them. */
const table = () => screen.getByRole("table", { name: /Causas, página/ });
const cards = () => screen.getByRole("list", { name: "Causas" });

describe("CaseListPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the firm's cases with legajo, place, people, stage and next hearing", async () => {
    const requests = signedIn(undefined, caseRoutes());
    renderApp("/causas");

    expect(await screen.findByRole("heading", { level: 1, name: "Causas" })).toBeInTheDocument();
    expect(await screen.findByText("4 causas en el estudio.")).toBeInTheDocument();
    expect(caseRequests(requests)[0]).toEqual({ page: "0", size: "20" });

    const row = within(table())
      .getByRole("link", { name: CASE_MODELO.caption })
      .closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("MPFNQ 10234/2026");
    expect(row).toHaveTextContent("I Circunscripción, Confluencia");
    expect(row).toHaveTextContent("1 imputado");
    expect(within(row).getByText("1 persona detenida")).toBeInTheDocument();
    expect(row).toHaveTextContent("Investigación preparatoria");
    expect(row).toHaveTextContent("23/11/2026, 11:00");
    expect(row).toHaveTextContent("Revisión de prisión preventiva");

    const reserved = within(cards()).getByRole("article", { name: CASE_EJEMPLAR.caption });
    expect(within(reserved).getByText("Reservada")).toBeInTheDocument();
    expect(within(reserved).getByText("2 imputados")).toBeInTheDocument();
    expect(within(reserved).queryByText(/persona detenida/)).not.toBeInTheDocument();

    // Archived cases stay out by default.
    expect(screen.queryByText("Prueba, Ana s/ hurto simple")).not.toBeInTheDocument();
  });

  it("opens a case from its row", async () => {
    signedIn(undefined, caseRoutes());
    const { router } = renderApp("/causas");

    fireEvent.click(
      await within(await screen.findByRole("table")).findByRole("link", {
        name: CASE_MODELO.caption,
      }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: CASE_MODELO.caption }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/causas/${CASE_MODELO.id}`);
  });

  it("searches as you type, keeps the text in the URL and explains an empty result", async () => {
    const requests = signedIn(undefined, caseRoutes());
    const { router } = renderApp("/causas");
    const box = await screen.findByRole("searchbox", { name: "Buscá una causa" });
    await screen.findByText("4 causas en el estudio.");

    fireEvent.change(box, { target: { value: "  modelo " } });

    await waitFor(() => expect(router.state.location.search).toEqual({ q: "modelo" }));
    expect(await screen.findByText("1 causa para «modelo».")).toBeInTheDocument();
    expect(caseRequests(requests).at(-1)).toEqual({ page: "0", size: "20", q: "modelo" });
    expect(within(table()).getAllByRole("row")).toHaveLength(2); // header + 1

    fireEvent.change(box, { target: { value: "inexistente" } });
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "No encontramos causas con «inexistente»",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Borrá la búsqueda" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(box).toHaveValue("");
    expect(await screen.findByText("4 causas en el estudio.")).toBeInTheDocument();
  });

  it("restores the search from a shared link", async () => {
    const requests = signedIn(undefined, caseRoutes());
    renderApp("/causas?q=ejemplar");

    expect(await screen.findByRole("searchbox", { name: "Buscá una causa" })).toHaveValue(
      "ejemplar",
    );
    expect(await screen.findByText("1 causa para «ejemplar».")).toBeInTheDocument();
    expect(caseRequests(requests)).toEqual([{ page: "0", size: "20", q: "ejemplar" }]);
  });

  it("pages through the results", async () => {
    const requests = signedIn(undefined, caseRoutes({ cases: manyCases(45), details: [] }));
    const { router } = renderApp("/causas");

    expect(await screen.findByText("45 causas en el estudio.")).toBeInTheDocument();
    const pages = screen.getByRole("navigation", { name: "Páginas de resultados" });
    expect(pages).toHaveTextContent("Página 1 de 3");
    expect(within(pages).getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(within(table()).getAllByRole("row")).toHaveLength(21);

    fireEvent.click(within(pages).getByRole("link", { name: "Siguiente" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pagina: 2 }));
    expect(
      await within(table()).findByRole("link", { name: "Ficticio 21, Caso s/ daño" }),
    ).toBeInTheDocument();
    expect(caseRequests(requests).at(-1)).toEqual({ page: "1", size: "20" });
    expect(screen.getByRole("navigation", { name: "Páginas de resultados" })).toHaveTextContent(
      "Página 2 de 3",
    );
  });

  it("includes the archived cases on demand, marked as such", async () => {
    const requests = signedIn(undefined, caseRoutes());
    const { router } = renderApp("/causas");
    await screen.findByText("4 causas en el estudio.");

    fireEvent.click(screen.getByRole("switch", { name: "Incluí las archivadas" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ archivadas: "si" }));
    expect(
      await screen.findByText("5 causas en el estudio, archivadas incluidas."),
    ).toBeInTheDocument();
    expect(caseRequests(requests).at(-1)).toEqual({
      page: "0",
      size: "20",
      includeArchived: "true",
    });
    const archived = within(cards()).getByRole("article", { name: "Prueba, Ana s/ hurto simple" });
    expect(within(archived).getByText("Archivada")).toBeInTheDocument();
  });

  it("invites to look at the archived ones when the firm has no open cases", async () => {
    signedIn(undefined, caseRoutes({ cases: CASES.filter((item) => item.archived) }));
    renderApp("/causas");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Todavía no hay causas" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mirá también las archivadas" }));
    expect(
      await screen.findByText("1 causa en el estudio, archivadas incluidas."),
    ).toBeInTheDocument();
  });

  it("leads back to the first page from a page that no longer has cases", async () => {
    signedIn(undefined, caseRoutes());
    const { router } = renderApp("/causas?pagina=5");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Esta página ya no tiene causas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hay 4 causas en total/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volvé a la primera página" }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    const firstPage = await screen.findByRole("table", { name: "Causas, página 1 de 1" });
    expect(within(firstPage).getByRole("link", { name: CASE_MODELO.caption })).toBeInTheDocument();
  });

  it("still lists the cases when the catalogs fail, without inventing names", async () => {
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/catalogs/stages": () => problem(500, "internal"),
      "GET /api/v1/catalogs/hearing-types": () => problem(500, "internal"),
    });
    renderApp("/causas");

    const link = await within(
      await screen.findByRole("table", undefined, { timeout: 4000 }),
    ).findByRole("link", { name: CASE_MODELO.caption });
    const row = link.closest("tr") as HTMLElement;
    // The date of the next hearing stays; its type name needs the catalog and is left out.
    expect(row).toHaveTextContent("23/11/2026, 11:00");
    expect(row).not.toHaveTextContent("Revisión de prisión preventiva");
    expect(within(row).getByText("1 persona detenida")).toBeInTheDocument();
  });

  it("explains a failure and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      ...caseRoutes(),
      "GET /api/v1/cases": () =>
        fail ? problem(500, "internal") : json(200, { items: [], page: 0, size: 20, total: 0 }),
    });
    renderApp("/causas");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar las causas");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Todavía no hay causas" }),
    ).toBeInTheDocument();
  });
});
