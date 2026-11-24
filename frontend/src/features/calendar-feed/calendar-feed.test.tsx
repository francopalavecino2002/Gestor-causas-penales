import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarFeedStatus } from "@/features/calendar-feed/calendar-feed-api";
import { agendaFor, FIXTURE_NOW, MONDAY_HEARINGS } from "@/test/agenda-fixtures";
import { CASE_MODELO, HEARINGS_BY_CASE } from "@/test/case-fixtures";
import {
  caseRoutes,
  DEMO_ME,
  json,
  noContent,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const SECRET = "c2VjcmV0by1maWN0aWNpby1kZS1wcnVlYmEtMDAwMDAwMDAw";
const SECRET_2 = "b3Ryby1zZWNyZXRvLWZpY3RpY2lvLWRlLXBydWViYS0xMTExMQ";
const CREATED_AT = "2026-11-23T13:20:00Z";

const INACTIVE: CalendarFeedStatus = { active: false, createdAt: null };
const ACTIVE: CalendarFeedStatus = { active: true, createdAt: CREATED_AT };

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET").map((request) => request.path);

/** A stateful stand-in for the three endpoints of the member's link. */
function feedRoutes(initial: CalendarFeedStatus) {
  let status = initial;
  let secrets = [SECRET, SECRET_2];
  return {
    "GET /api/v1/me/calendar-feed": () => json(200, status),
    "POST /api/v1/me/calendar-feed": () => {
      const [secret, ...rest] = secrets;
      secrets = rest;
      status = { active: true, createdAt: CREATED_AT };
      return json(201, { path: `/api/v1/calendar-feed/${secret}.ics`, createdAt: CREATED_AT });
    },
    "POST /api/v1/me/calendar-feed/revoke": () => {
      status = INACTIVE;
      return noContent();
    },
  };
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(writeText) },
    configurable: true,
  });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

describe("settings: the member's calendar link", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("explains the link and creates it; the full address shows once, ready to copy", async () => {
    const requests = signedIn(undefined, feedRoutes(INACTIVE));
    const writeText = stubClipboard(() => Promise.resolve());
    renderApp("/ajustes/calendario");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tu calendario" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Sin enlace")).toBeInTheDocument();
    expect(screen.getByText(/Es un enlace privado que tu calendario consulta solo/)).toBeVisible();
    expect(screen.getByText(/aparece como «Causa reservada»/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Creá tu enlace" }));

    const url = `${window.location.origin}/api/v1/calendar-feed/${SECRET}.ics`;
    const input = await screen.findByLabelText("Tu enlace privado");
    expect(input).toHaveValue(url);
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText("Guardalo ahora: se muestra una sola vez")).toBeInTheDocument();
    expect(screen.getByText("Enlace activo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrí en tu calendario" })).toHaveAttribute(
      "href",
      url.replace(/^https?:/, "webcal:"),
    );
    expect(writes(requests)).toEqual(["/api/v1/me/calendar-feed"]);

    fireEvent.click(screen.getByRole("button", { name: "Copiá el enlace" }));
    expect(await screen.findByText("Copiado. Pegalo en tu calendario.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("selects the address to copy by hand when the clipboard is not available", async () => {
    signedIn(undefined, feedRoutes(INACTIVE));
    stubClipboard(() => Promise.reject(new Error("not allowed")));
    renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Creá tu enlace" }));
    const input = await screen.findByLabelText<HTMLInputElement>("Tu enlace privado");
    fireEvent.click(screen.getByRole("button", { name: "Copiá el enlace" }));

    expect(await screen.findByText(/No pudimos copiarlo solo/)).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length);
  });

  it("says since when a link is active, without showing it, and replaces it after confirming", async () => {
    const requests = signedIn({ ...DEMO_ME, role: "PARALEGAL" }, feedRoutes(ACTIVE));
    renderApp("/ajustes/calendario");

    expect(await screen.findByText(/Tenés un enlace activo desde el/)).toHaveTextContent(
      "lunes 23 de noviembre de 2026, 10:20",
    );
    expect(screen.getByText(/no lo podemos volver a mostrar/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu enlace privado")).not.toBeInTheDocument();
    // Personal: no "only the owner can change this" note for other roles.
    expect(screen.queryByText(/Solo la persona titular/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generá un enlace nuevo" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Generás un enlace nuevo?" });
    expect(dialog).toHaveTextContent("El enlace actual deja de funcionar");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes(requests)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Generá un enlace nuevo" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Generá el enlace nuevo",
      }),
    );

    const input = await screen.findByLabelText("Tu enlace privado");
    expect(input).toHaveValue(`${window.location.origin}/api/v1/calendar-feed/${SECRET}.ics`);
    // The closing dialog does not pull focus back to the button: it lands on the new address.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(input).toHaveFocus());
    expect(
      screen.getByText("Listo: generaste un enlace nuevo. El anterior ya no funciona."),
    ).toBeInTheDocument();
    expect(writes(requests)).toEqual(["/api/v1/me/calendar-feed"]);
  });

  it("deactivates the link after confirming", async () => {
    const requests = signedIn(undefined, feedRoutes(ACTIVE));
    renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Desactivá el enlace" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Desactivás el enlace?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá el enlace" }));

    expect(await screen.findByText(/Listo: desactivaste el enlace/)).toBeInTheDocument();
    expect(screen.getByText("Sin enlace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Creá tu enlace" })).toBeInTheDocument();
    expect(writes(requests)).toEqual(["/api/v1/me/calendar-feed/revoke"]);
  });

  it("says what failed when the link cannot be created", async () => {
    signedIn(undefined, {
      "GET /api/v1/me/calendar-feed": () => json(200, INACTIVE),
      "POST /api/v1/me/calendar-feed": () => problem(500, "internal"),
    });
    renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Creá tu enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cambiar tu enlace. Volvé a intentar en unos minutos.",
    );
    expect(screen.queryByLabelText("Tu enlace privado")).not.toBeInTheDocument();
  });

  it("replaces a link just created, and focus lands on the new address", async () => {
    signedIn(undefined, feedRoutes(INACTIVE));
    renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Creá tu enlace" }));
    const input = await screen.findByLabelText("Tu enlace privado");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Generá un enlace nuevo" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Generá el enlace nuevo",
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Tu enlace privado")).toHaveValue(
        `${window.location.origin}/api/v1/calendar-feed/${SECRET_2}.ics`,
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Tu enlace privado")).toHaveFocus());
  });

  it("never shows the address again after leaving the screen, nor keeps it in the cache", async () => {
    signedIn(undefined, feedRoutes(INACTIVE));
    const { router, queryClient } = renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Creá tu enlace" }));
    expect(await screen.findByLabelText("Tu enlace privado")).toHaveValue(
      `${window.location.origin}/api/v1/calendar-feed/${SECRET}.ics`,
    );

    await router.navigate({ to: "/ajustes" });
    await screen.findByRole("heading", { level: 1, name: "Ajustes" });
    await router.navigate({ to: "/ajustes/calendario" });

    expect(await screen.findByText(/Tenés un enlace activo desde el/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu enlace privado")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SECRET);
    await waitFor(() =>
      expect(
        JSON.stringify(
          queryClient
            .getMutationCache()
            .getAll()
            .map((m) => m.state),
        ),
      ).not.toContain(SECRET),
    );
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(SECRET);
  });

  it("says when the status cannot be read, and tries again", async () => {
    let fail = true;
    signedIn(undefined, {
      "GET /api/v1/me/calendar-feed": () => (fail ? problem(500, "internal") : json(200, INACTIVE)),
    });
    renderApp("/ajustes/calendario");

    expect(
      await screen.findByText("No pudimos ver si tenés un enlace activo", {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Volvé a intentar" }));

    expect(await screen.findByRole("button", { name: "Creá tu enlace" })).toBeInTheDocument();
    expect(screen.queryByText("No pudimos ver si tenés un enlace activo")).not.toBeInTheDocument();
  }, 15_000);

  it("keeps the link active and says what failed when it cannot be deactivated", async () => {
    signedIn(undefined, {
      "GET /api/v1/me/calendar-feed": () => json(200, ACTIVE),
      "POST /api/v1/me/calendar-feed/revoke": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderApp("/ajustes/calendario");

    fireEvent.click(await screen.findByRole("button", { name: "Desactivá el enlace" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Desactivá el enlace",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a intentar.",
    );
    expect(screen.getByText("Enlace activo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivá el enlace" })).toBeEnabled();
  });

  it("shows the steps for each calendar app", async () => {
    signedIn(undefined, feedRoutes(INACTIVE));
    renderApp("/ajustes/calendario");

    expect(await screen.findByRole("list", { name: "Pasos en Google Calendar" })).toHaveTextContent(
      "Desde URL",
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "iPhone" }));
    expect(await screen.findByRole("list", { name: "Pasos en iPhone" })).toHaveTextContent(
      "Agregar calendario suscripto",
    );
  });
});

describe("a hearing's 'Agregá al calendario'", () => {
  const target = MONDAY_HEARINGS[2]!;
  const buttonName = `Agregá al calendario la audiencia ${target.typeName}`;
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FIXTURE_NOW));
    clicked = [];
    URL.createObjectURL = vi.fn(() => "blob:audiencia");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const agenda = {
    "GET /api/v1/agenda": ({ query }: RecordedRequest) =>
      json(200, agendaFor(MONDAY_HEARINGS, query.from ?? "", query.to ?? "")),
  };

  it("downloads the hearing as audiencia.ics with the session", async () => {
    const requests = signedIn(undefined, {
      ...agenda,
      [`GET /api/v1/hearings/${target.hearingId}/calendar.ics`]: () =>
        new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
          status: 200,
          headers: { "Content-Type": "text/calendar" },
        }),
    });
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: buttonName }));

    await waitFor(() =>
      expect(clicked).toEqual([{ href: "blob:audiencia", download: "audiencia.ics" }]),
    );
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:audiencia"));
    const ics = requests.find((request) => request.path.endsWith("/calendar.ics"));
    expect(ics?.headers.accept).toContain("text/calendar");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says what failed and what to do when the file cannot be downloaded", async () => {
    signedIn(undefined, {
      ...agenda,
      [`GET /api/v1/hearings/${target.hearingId}/calendar.ics`]: () => problem(404, "not-found"),
    });
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: buttonName }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos descargar el archivo: la audiencia ya no está disponible. Recargá la página.",
    );
    expect(clicked).toEqual([]);
  });

  it("says there is no connection when the download never reaches the server", async () => {
    signedIn(undefined, {
      ...agenda,
      [`GET /api/v1/hearings/${target.hearingId}/calendar.ics`]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderApp("/");

    fireEvent.click(await screen.findByRole("button", { name: buttonName }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos descargar el archivo: no hay conexión. Revisá tu internet y volvé a intentar.",
    );
    expect(clicked).toEqual([]);
  });

  it("is offered on each hearing of a case, too", async () => {
    const [caseHearing] = HEARINGS_BY_CASE[CASE_MODELO.id]!;
    signedIn(undefined, {
      ...caseRoutes(),
      [`GET /api/v1/hearings/${caseHearing!.id}/calendar.ics`]: () =>
        new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
          status: 200,
          headers: { "Content-Type": "text/calendar" },
        }),
    });
    renderApp(`/causas/${CASE_MODELO.id}`);

    const buttons = await screen.findAllByRole("button", {
      name: `Agregá al calendario la audiencia ${caseHearing!.typeName}`,
    });
    fireEvent.click(buttons[0]!);

    await waitFor(() =>
      expect(clicked).toEqual([{ href: "blob:audiencia", download: "audiencia.ics" }]),
    );
  });
});
