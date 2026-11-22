import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readRememberedFirms, rememberFirm } from "@/features/firms/remembered-firms";
import { apiFetch } from "@/lib/api";
import { DEMO_ME, json, noContent, problem, signedIn } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const OTHER_FIRM = {
  slug: "estudio-norte",
  name: "Estudio Norte (ficticio)",
  lastEmail: "lucia.norte@example.com",
};

/** Signed in until POST /auth/logout; then /me answers 401, as the real backend does. */
function sessionUntilLogout() {
  let session = true;
  return signedIn(DEMO_ME, {
    "GET /api/v1/me": () =>
      session ? json(200, DEMO_ME) : problem(401, "authentication-required"),
    "POST /api/v1/auth/logout": () => {
      session = false;
      return noContent();
    },
  });
}

/** Radix menus open from the keyboard in jsdom (it has no pointer events). */
function openMenu(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: "Enter" });
}

const firstMatch = (elements: HTMLElement[]) => {
  const [first] = elements;
  if (!first) throw new Error("No element found");
  return first;
};

describe("app shell", () => {
  it("shows the sections and marks the current one with aria-current", async () => {
    signedIn();
    const { router } = renderApp("/");

    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    const nav = firstMatch(screen.getAllByRole("navigation", { name: "Secciones" }));
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Agenda",
      "Causas",
      "Plazos",
      "Personas",
    ]);
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(within(nav).getByRole("link", { name: "Causas" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Causas" })).toBeInTheDocument();
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/causas");
    expect(within(nav).getByRole("link", { name: "Causas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Agenda" })).not.toHaveAttribute("aria-current");
  });

  it("has a skip link to the main content", async () => {
    signedIn();
    renderApp("/plazos");

    await screen.findByRole("heading", { level: 1, name: "Plazos" });
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute(
      "href",
      "#contenido",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenido");
  });

  it("shows the firm, the user and the role in Spanish", async () => {
    signedIn({ ...DEMO_ME, role: "PARALEGAL", displayName: "Sofía Ficticia" });
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    expect(
      screen.getAllByRole("button", {
        name: "Estudio: Estudio Demo (ficticio). Cambiar de estudio",
      }),
    ).not.toHaveLength(0);
    openMenu(
      firstMatch(
        screen.getAllByRole("button", { name: "Tu cuenta: Sofía Ficticia, Procurador/a" }),
      ),
    );

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Sofía Ficticia")).toBeInTheDocument();
    expect(within(menu).getByText("Procurador/a")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "Según el sistema" })).toBeChecked();
  });

  it("signs out and opens the login", async () => {
    const requests = sessionUntilLogout();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    openMenu(firstMatch(screen.getAllByRole("button", { name: /Tu cuenta/ })));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }));

    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });
    expect(router.state.location.pathname).toBe("/ingresar");
    const logout = requests.find((r) => r.method === "POST" && r.path === "/api/v1/auth/logout");
    expect(logout?.headers["x-xsrf-token"]).toBe("token-1");
  });

  it("switches to a remembered firm by signing out and prefilling the login", async () => {
    rememberFirm(OTHER_FIRM);
    rememberFirm({ slug: "estudio-demo", name: DEMO_ME.tenant.name, lastEmail: DEMO_ME.email });
    sessionUntilLogout();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    openMenu(firstMatch(screen.getAllByRole("button", { name: /Cambiar de estudio/ })));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Estudio actual")).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Estudio Norte \(ficticio\)/ }));

    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });
    expect(router.state.location.search).toEqual({ estudio: "estudio-norte" });
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-norte");
    expect(screen.getByLabelText("Email")).toHaveValue("lucia.norte@example.com");
  });

  it("forgets the current firm on this device after confirming", async () => {
    rememberFirm({ slug: "estudio-demo", name: DEMO_ME.tenant.name, lastEmail: DEMO_ME.email });
    sessionUntilLogout();
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    openMenu(firstMatch(screen.getAllByRole("button", { name: /Cambiar de estudio/ })));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Olvidar este estudio en este dispositivo" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cerrá la sesión y olvidá el estudio" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/ingresar"));
    expect(readRememberedFirms()).toEqual([]);
  });

  it("keeps the session and says so when signing out fails", async () => {
    signedIn(DEMO_ME, { "POST /api/v1/auth/logout": () => problem(500, "internal") });
    const { router } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });

    openMenu(firstMatch(screen.getAllByRole("button", { name: /Tu cuenta/ })));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cerrar la sesión");
    expect(router.state.location.pathname).toBe("/");
  });

  it("opens the login, keeping the page, when the session expires", async () => {
    signedIn(DEMO_ME, { "GET /api/v1/cases": () => problem(401, "authentication-required") });
    const { router, queryClient } = renderApp("/personas");
    await screen.findByRole("heading", { level: 1, name: "Personas" });

    await queryClient
      .fetchQuery({ queryKey: ["cases"], queryFn: () => apiFetch("/api/v1/cases") })
      .catch(() => undefined);

    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });
    expect(router.state.location.search).toEqual({ redirect: "/personas" });
  });
});
