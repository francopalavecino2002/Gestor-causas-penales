import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_MODELO } from "@/test/case-fixtures";
import { newsRoutes, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { DUE_SOON_EVIDENCE } from "@/test/news-fixtures";

const newsQueries = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/news").map((request) => request.query);

const newsCard = () => screen.findByRole("region", { name: "Novedades" });

describe("Novedades on the agenda", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the latest entries, the deadlines due soon and a way to the wall", async () => {
    const requests = signedIn(undefined, newsRoutes());
    renderApp("/");

    const card = await newsCard();
    const list = await within(card).findByRole("list", { name: "Últimas novedades" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(list).toHaveTextContent("Paula Demo publicó:");
    expect(list).toHaveTextContent("Hace 15 minutos");
    expect(list).toHaveTextContent("Ayer, 18:30");
    expect(within(list).getByRole("link", { name: CASE_MODELO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_MODELO.id}`,
    );
    expect(within(card).getByRole("link", { name: "2 plazos vencen pronto." })).toHaveAttribute(
      "href",
      "/novedades",
    );
    expect(card).toHaveTextContent("Uno es de una persona detenida.");
    expect(within(card).getByRole("link", { name: "Mirá todas las novedades" })).toHaveAttribute(
      "href",
      "/novedades",
    );
    expect(newsQueries(requests)).toEqual([{ page: "0", size: "5" }]);
    // The day's hearings stay the page's subject.
    expect(screen.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeInTheDocument();
  });

  it("leaves out the detainee line when no deadline due soon is of a detained client", async () => {
    signedIn(undefined, newsRoutes(undefined, [DUE_SOON_EVIDENCE]));
    renderApp("/");

    const card = await newsCard();
    expect(await within(card).findByText(/1 plazo vence pronto/)).toBeInTheDocument();
    expect(card).not.toHaveTextContent("detenida");
  });

  it("says so when the wall is empty", async () => {
    signedIn();
    renderApp("/");

    const card = await newsCard();
    expect(
      await within(card).findByText("Todavía no hay novedades en el estudio."),
    ).toBeInTheDocument();
    expect(card).not.toHaveTextContent("vence");
  });

  it("keeps the agenda usable when the wall fails to load", async () => {
    signedIn(undefined, { "GET /api/v1/news": () => problem(500, "internal") });
    renderApp("/");

    const card = await newsCard();
    expect(
      await within(card).findByText("No pudimos cargar las novedades.", undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Volvé a intentar" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Audiencias de hoy" }),
    ).toBeInTheDocument();
  });
});
