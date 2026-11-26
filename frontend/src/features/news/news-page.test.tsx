import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import { CASE_EJEMPLO, CASE_MUESTRA } from "@/test/case-fixtures";
import { json, newsRoutes, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import {
  DUE_SOON_CONTROL,
  DUE_SOON_EVIDENCE,
  manyPosts,
  NEWS_POST_MEETING,
  NEWS_POST_TEMPLATE,
} from "@/test/news-fixtures";

const newsGets = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method === "GET" && request.path === "/api/v1/news")
    .map((request) => request.query);

const day = (name: string) => screen.getByRole("region", { name });

describe("NewsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW)); // Monday 23 November 2026, 10:20 in Neuquén
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the wall by day, newest first, with a sentence and a link per entry", async () => {
    const requests = signedIn(undefined, newsRoutes());
    renderApp("/novedades");

    expect(await screen.findByRole("heading", { level: 1, name: "Novedades" })).toBeInTheDocument();
    await screen.findByRole("region", { name: "Hoy" });
    expect(newsGets(requests)[0]).toEqual({ page: "0", size: "20" });

    const today = day("Hoy");
    expect(today).toHaveTextContent(
      "Paula Demo reprogramó la audiencia de control de acusación del jueves 3/12 a las 10:00 al jueves 10/12 a las 11:00.",
    );
    expect(today).toHaveTextContent(
      "Hugo Prueba cargó el resultado de la audiencia de revisión de prisión preventiva del lunes 23/11: Efectiva.",
    );
    expect(today).toHaveTextContent(
      "Cargaste la audiencia de formulación de cargos para el lunes 30/11 a las 10:00.",
    );
    expect(within(today).getByText("Hace 15 minutos")).toBeInTheDocument();
    expect(within(today).getByRole("link", { name: CASE_MUESTRA.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_MUESTRA.id}`,
    );
    expect(
      within(today)
        .getAllByRole("link", { name: "Mirá ese día en la agenda" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/?fecha=2026-11-23", "/?fecha=2026-12-10", "/?fecha=2026-11-30"]);

    // A post keeps its line breaks as plain text.
    const body = within(today).getByText(/nos juntamos para repartir/);
    expect(body.textContent).toBe(NEWS_POST_MEETING.post?.body);
    expect(body).toHaveClass("whitespace-pre-line");

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      expect.arrayContaining([
        "Hoy",
        "Ayer",
        "Jueves 19 de noviembre",
        "Miércoles 18 de noviembre",
      ]),
    );
  });

  it("collapses an import into one entry that lists its cases", async () => {
    signedIn(undefined, newsRoutes());
    renderApp("/novedades");

    const thursday = await screen.findByRole("region", { name: "Jueves 19 de noviembre" });
    expect(thursday).toHaveTextContent("Paula Demo abrió 4 causas nuevas.");
    const toggle = within(thursday).getByRole("button", { name: "Mirá las 4 causas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(thursday).queryByRole("link", { name: "Ficticio, Ramiro s/ hurto" })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(thursday).getAllByRole("link")).toHaveLength(4);
    expect(within(thursday).getByRole("link", { name: "Ficticio, Ramiro s/ hurto" })).toBeVisible();
  });

  it("lists the deadlines due soon, detained clients first, with source and disclaimer", async () => {
    signedIn(undefined, newsRoutes());
    renderApp("/novedades");

    const section = await screen.findByRole("region", { name: "Vencen pronto" });
    const cards = within(section).getAllByRole("article");
    expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual([
      DUE_SOON_CONTROL.ruleName,
      DUE_SOON_EVIDENCE.ruleName,
    ]);
    const [control, evidence] = cards;
    if (!control || !evidence) throw new Error("cards");
    expect(within(control).getByText("Persona detenida")).toBeInTheDocument();
    expect(control).toHaveTextContent(DUE_SOON_CONTROL.source);
    expect(control).toHaveTextContent("Quedan 15 horas");
    expect(control).toHaveTextContent("Vence el martes 24/11 a las 02:00");
    expect(within(control).getByRole("link", { name: CASE_EJEMPLO.caption })).toHaveAttribute(
      "href",
      `/causas/${CASE_EJEMPLO.id}`,
    );
    expect(within(evidence).queryByText("Persona detenida")).toBeNull();
    expect(evidence).toHaveTextContent(DUE_SOON_EVIDENCE.source);
    expect(evidence).toHaveTextContent("Quedan 4 días");
    expect(section).toHaveTextContent("Cálculo asistido: verificá con la norma.");
    expect(within(section).getByRole("link", { name: "Mirá todos los plazos" })).toHaveAttribute(
      "href",
      "/plazos",
    );
  });

  it("hides the deadlines when nothing is due soon", async () => {
    signedIn(undefined, newsRoutes(undefined, []));
    renderApp("/novedades");

    await screen.findByRole("region", { name: "Hoy" });
    expect(screen.queryByRole("region", { name: "Vencen pronto" })).toBeNull();
  });

  it("publishes a post that shows first on the wall", async () => {
    const requests = signedIn(undefined, newsRoutes());
    renderApp("/novedades");
    await screen.findByRole("region", { name: "Hoy" });

    const field = screen.getByLabelText("Contale algo al estudio");
    fireEvent.change(field, { target: { value: "  El viernes cerramos a las 13.\nAvisen.  " } });
    expect(screen.getByText("41 de 1000 caracteres")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publicá" }));

    await waitFor(() => expect(field).toHaveValue(""));
    const post = requests.find((request) => request.path === "/api/v1/news/posts");
    expect(post?.body).toEqual({ body: "El viernes cerramos a las 13.\nAvisen." });
    expect(post?.headers["x-xsrf-token"]).toBe("token-1");
    expect(await screen.findByText("Publicaste la novedad.")).toBeInTheDocument();
    const today = await screen.findByRole("region", { name: "Hoy" });
    await waitFor(() =>
      expect(within(today).getAllByRole("listitem")[0]).toHaveTextContent(
        "Lucía Ejemplo (vos)Recién",
      ),
    );
  });

  it("asks for text before posting and says what the server rejected", async () => {
    const requests = signedIn(undefined, {
      ...newsRoutes(),
      "POST /api/v1/news/posts": () => problem(400, "invalid-post"),
    });
    renderApp("/novedades");
    await screen.findByRole("region", { name: "Hoy" });

    const field = screen.getByLabelText("Contale algo al estudio");
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Publicá" }));
    expect(await screen.findByText("Escribí la novedad antes de publicarla.")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((request) => request.path === "/api/v1/news/posts")).toBe(false);

    fireEvent.change(field, { target: { value: "Aviso" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicá" }));
    expect(
      await screen.findByText("Escribí la novedad, con hasta 1000 caracteres."),
    ).toBeInTheDocument();
    expect(field).toHaveValue("Aviso");
  });

  it("archives a post and brings it back with Deshacé", async () => {
    const requests = signedIn(undefined, newsRoutes());
    renderApp("/novedades");
    await screen.findByRole("region", { name: "Hoy" });

    fireEvent.click(screen.getByRole("button", { name: "Archivá la publicación de Paula Demo" }));

    const undo = await screen.findByRole("button", { name: "Deshacé" });
    expect(screen.getByText("Archivaste esta publicación.")).toBeInTheDocument();
    expect(screen.queryByText(/nos juntamos para repartir/)).toBeNull();
    await waitFor(() => expect(undo).toHaveFocus());
    expect(screen.getByText(/Archivaste la publicación\. Si fue sin querer/)).toBeInTheDocument();
    const postId = NEWS_POST_MEETING.post?.id;
    expect(
      requests.some((request) => request.path === `/api/v1/news/posts/${postId}/archive`),
    ).toBe(true);

    fireEvent.click(undo);

    expect(await screen.findByText(/nos juntamos para repartir/)).toBeInTheDocument();
    expect(screen.getByText("La publicación volvió al muro.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Archivá la publicación de Paula Demo" }),
      ).toHaveFocus(),
    );
    expect(
      requests.some((request) => request.path === `/api/v1/news/posts/${postId}/restore`),
    ).toBe(true);
  });

  it("explains a refused archive and keeps the post", async () => {
    const postId = NEWS_POST_TEMPLATE.post?.id ?? "";
    signedIn(undefined, {
      ...newsRoutes(),
      [`POST /api/v1/news/posts/${postId}/archive`]: () => problem(403, "access-denied"),
    });
    renderApp("/novedades");
    await screen.findByRole("region", { name: "Ayer" });

    fireEvent.click(
      within(day("Ayer")).getByRole("button", { name: "Archivá la publicación de Lucía Ejemplo" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo quien escribió la publicación o la persona titular del estudio pueden archivarla.",
    );
    expect(within(day("Ayer")).getByText(/modelo de escrito/)).toBeInTheDocument();
    // The button was disabled while waiting: the focus goes back to it.
    await waitFor(() =>
      expect(
        within(day("Ayer")).getByRole("button", {
          name: "Archivá la publicación de Lucía Ejemplo",
        }),
      ).toHaveFocus(),
    );
  });

  it("reads the wall again on the next visit, without the archived post", async () => {
    const requests = signedIn(undefined, newsRoutes());
    const { router } = renderApp("/novedades");
    await screen.findByRole("region", { name: "Hoy" });

    fireEvent.click(screen.getByRole("button", { name: "Archivá la publicación de Paula Demo" }));
    await screen.findByRole("button", { name: "Deshacé" });
    // The open wall keeps the undo row: no refetch yet.
    expect(newsGets(requests)).toHaveLength(1);

    await router.navigate({ to: "/tareas" });
    await screen.findByRole("heading", { level: 1, name: "Tareas" });
    await router.navigate({ to: "/novedades" });

    await waitFor(() => expect(newsGets(requests)).toHaveLength(2));
    const today = await screen.findByRole("region", { name: "Hoy" });
    await waitFor(() => expect(within(today).queryByText(/nos juntamos para repartir/)).toBeNull());
    expect(screen.queryByRole("button", { name: "Deshacé" })).toBeNull();
    expect(today).toHaveTextContent("Hugo Prueba cargó el resultado");
  });

  it("shows a post as text, never as markup", async () => {
    const [post] = manyPosts(1);
    if (!post?.post) throw new Error("fixture");
    const tricky = {
      ...post,
      post: { ...post.post, body: "<b>Ojo</b> <img src=x onerror=alert(1)>" },
    };
    signedIn(undefined, newsRoutes([tricky], []));
    const { container } = renderApp("/novedades");

    expect(await screen.findByText("<b>Ojo</b> <img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("main img")).toBeNull();
    expect(container.querySelector("main b")).toBeNull();
  });

  it("loads more entries until it reaches the total", async () => {
    const requests = signedIn(undefined, newsRoutes(manyPosts(25), []));
    renderApp("/novedades");

    await screen.findByText("Aviso ficticio número 20.");
    expect(screen.queryByText("Aviso ficticio número 21.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mirá más novedades" }));

    expect(await screen.findByText("Aviso ficticio número 25.")).toBeInTheDocument();
    expect(newsGets(requests)).toEqual([
      { page: "0", size: "20" },
      { page: "1", size: "20" },
    ]);
    expect(screen.queryByRole("button", { name: "Mirá más novedades" })).toBeNull();
  });

  it("shows an entry once when a new one shifted the pages in between", async () => {
    const posts = manyPosts(25);
    signedIn(undefined, {
      "GET /api/v1/news": ({ query }) =>
        query.page === "1"
          ? // Someone posted after page 0: post 20 moved onto page 1.
            json(200, { dueSoon: [], items: posts.slice(19), page: 1, size: 20, total: 26 })
          : json(200, { dueSoon: [], items: posts.slice(0, 20), page: 0, size: 20, total: 25 }),
    });
    renderApp("/novedades");

    await screen.findByText("Aviso ficticio número 20.");
    fireEvent.click(screen.getByRole("button", { name: "Mirá más novedades" }));

    expect(await screen.findByText("Aviso ficticio número 25.")).toBeInTheDocument();
    expect(screen.getAllByText("Aviso ficticio número 20.")).toHaveLength(1);
  });

  it("offers more instead of the empty state when a page comes back empty but more remain", async () => {
    const posts = manyPosts(3);
    signedIn(undefined, {
      // The total counted entries the backend then left out of page 0.
      "GET /api/v1/news": ({ query }) =>
        query.page === "1"
          ? json(200, { dueSoon: [], items: posts, page: 1, size: 20, total: 23 })
          : json(200, { dueSoon: [], items: [], page: 0, size: 20, total: 23 }),
    });
    renderApp("/novedades");

    const more = await screen.findByRole("button", { name: "Mirá más novedades" });
    expect(screen.queryByRole("heading", { name: "Todavía no hay novedades" })).toBeNull();
    fireEvent.click(more);

    expect(await screen.findByText("Aviso ficticio número 3.")).toBeInTheDocument();
  });

  it("invites to write the first post when the wall is empty", async () => {
    signedIn();
    renderApp("/novedades");

    expect(
      await screen.findByRole("heading", { name: "Todavía no hay novedades" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Escribí la primera" }));
    expect(screen.getByLabelText("Contale algo al estudio")).toHaveFocus();
  });

  it("says what failed and retries", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/news": () =>
        fail
          ? problem(500, "internal")
          : json(200, { dueSoon: [], items: manyPosts(1), page: 0, size: 20, total: 1 }),
    });
    renderApp("/novedades");

    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert).toHaveTextContent("No pudimos cargar las novedades");
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Volvé a intentar" }));

    expect(await screen.findByText("Aviso ficticio número 1.")).toBeInTheDocument();
  });
});
