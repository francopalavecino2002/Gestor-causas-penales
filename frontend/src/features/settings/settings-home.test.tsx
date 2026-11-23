import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, signedIn } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";

describe("settings: index and users", () => {
  it("lists the sections and says plainly that templates are not there yet", async () => {
    signedIn(undefined, settingsRoutes().routes);
    const { router } = renderApp("/ajustes");

    expect(await screen.findByRole("heading", { level: 1, name: "Ajustes" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Secciones de ajustes" });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/ajustes/catalogos",
      "/ajustes/campos",
      "/ajustes/plazos",
      "/ajustes/usuarios",
    ]);
    expect(nav).toHaveTextContent("Plantillas por tipo de causa");
    expect(nav).toHaveTextContent("Todavía no disponible");

    fireEvent.click(within(nav).getByRole("link", { name: /Reglas de plazos/ }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Reglas de plazos" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ajustes/plazos");
    const main = screen.getByRole("main");
    expect(within(main).getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/ajustes");
    const sections = within(main).getByRole("navigation", { name: "Secciones de ajustes" });
    expect(within(sections).getByRole("link", { name: "Reglas de plazos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sections).getByRole("link", { name: "Catálogos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the account, its role and 2FA status, and what each role can do, without a fake user list", async () => {
    signedIn({ ...DEMO_ME, role: "PARALEGAL", twoFactorEnabled: false }, settingsRoutes().routes);
    renderApp("/ajustes/usuarios");

    const account = await screen.findByRole("region", { name: "Tu cuenta" });
    expect(account).toHaveTextContent("Lucía Ejemplo");
    expect(account).toHaveTextContent("lucia.ejemplo@example.com");
    expect(account).toHaveTextContent("RolProcurador/a");
    expect(account).toHaveTextContent("Verificación en dos pasosDesactivada");
    expect(account).toHaveTextContent("Te recomendamos activarla");
    expect(screen.getByText(/Invitar personas, cambiar roles y desactivar cuentas llega con una próxima versión/)).toBeInTheDocument();

    const roles = screen.getByRole("region", { name: "Qué puede hacer cada rol" });
    expect(within(roles).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Titular",
      "Abogado/a",
      "Procurador/a",
      "Administrativo/a",
    ]);
    expect(roles).toHaveTextContent("Ve todas las causas, también las reservadas.");
  });

  it("shows 2FA as on when it is", async () => {
    signedIn({ ...DEMO_ME, twoFactorEnabled: true }, settingsRoutes().routes);
    renderApp("/ajustes/usuarios");

    const account = await screen.findByRole("region", { name: "Tu cuenta" });
    expect(account).toHaveTextContent("RolTitular");
    expect(account).toHaveTextContent("Verificación en dos pasosActivada");
  });
});
