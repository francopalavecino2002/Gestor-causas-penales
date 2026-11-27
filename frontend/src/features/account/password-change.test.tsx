import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DEMO_ME,
  json,
  passwordRoutes,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";
import { DEMO_PASSWORD } from "@/test/two-factor-fixtures";
import { TEMPORARY_PASSWORDS } from "@/test/firm-user-fixtures";

const NEW_PASSWORD = "otra frase larga ficticia";

const passwordWrites = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/me/password");

function fill(scope: HTMLElement, current: string, next: string, repeat = next) {
  fireEvent.change(within(scope).getByLabelText(/^(Tu contraseña actual|Contraseña temporal)$/), {
    target: { value: current },
  });
  fireEvent.change(within(scope).getByLabelText("Contraseña nueva"), { target: { value: next } });
  fireEvent.change(within(scope).getByLabelText("Repetí la contraseña nueva"), {
    target: { value: repeat },
  });
}

async function openChangeDialog() {
  const account = await screen.findByRole("region", { name: "Tu cuenta" });
  fireEvent.click(within(account).getByRole("button", { name: "Cambiá tu contraseña" }));
  return screen.findByRole("dialog", { name: "Cambiá tu contraseña" });
}

describe("changing the own password", () => {
  it("checks the fields before sending, explains a wrong current password (422) and a rejected new one (400)", async () => {
    const password = passwordRoutes(DEMO_ME, DEMO_PASSWORD);
    const requests = signedIn(DEMO_ME, { ...settingsRoutes().routes, ...password.routes });
    renderApp("/ajustes/usuarios");
    const dialog = await openChangeDialog();
    expect(dialog).toHaveTextContent("se cierra tu sesión en todos tus dispositivos");
    const save = within(dialog).getByRole("button", { name: "Guardá la contraseña nueva" });

    fill(dialog, DEMO_PASSWORD, "corta", "corta");
    fireEvent.click(save);
    expect(
      await within(dialog).findByText(
        "La contraseña nueva tiene que tener al menos 12 caracteres.",
      ),
    ).toBeInTheDocument();

    fill(dialog, DEMO_PASSWORD, NEW_PASSWORD, "otra frase distinta");
    fireEvent.click(save);
    expect(
      await within(dialog).findByText(/Las dos contraseñas nuevas no coinciden/),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Repetí la contraseña nueva")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    fill(dialog, DEMO_PASSWORD, DEMO_PASSWORD);
    fireEvent.click(save);
    expect(
      await within(dialog).findByText("Elegí una contraseña distinta de la actual."),
    ).toBeInTheDocument();
    expect(passwordWrites(requests)).toEqual([]);

    // The server says the current one is wrong: the field is cleared, marked and focused.
    fill(dialog, "no-es-la-clave", NEW_PASSWORD);
    fireEvent.click(save);
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("La contraseña actual no es correcta.");
    const current = within(dialog).getByLabelText("Tu contraseña actual");
    expect(current).toHaveValue("");
    expect(current).toHaveAttribute("aria-invalid", "true");
    expect(current.getAttribute("aria-describedby")).toContain(alert.id);
    await waitFor(() => expect(current).toHaveFocus());
    expect(passwordWrites(requests)).toHaveLength(1);
  });

  it("explains a new password the server rejects (400 invalid-password)", async () => {
    const requests = signedIn(DEMO_ME, {
      ...settingsRoutes().routes,
      "POST /api/v1/me/password": () =>
        new Response(
          JSON.stringify({
            type: "/problems/invalid-password",
            status: 400,
            detail: "Password must not exceed 72 bytes in UTF-8",
          }),
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
    });
    renderApp("/ajustes/usuarios");
    const dialog = await openChangeDialog();
    fill(dialog, DEMO_PASSWORD, NEW_PASSWORD);
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la contraseña nueva" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La contraseña nueva es demasiado larga.",
    );
    expect(within(dialog).getByLabelText("Contraseña nueva")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(passwordWrites(requests)).toHaveLength(1);
  });

  it("says how long to wait after too many attempts (429)", async () => {
    signedIn(DEMO_ME, {
      ...settingsRoutes().routes,
      "POST /api/v1/me/password": () => problem(429, "login-throttled", { "Retry-After": "120" }),
    });
    renderApp("/ajustes/usuarios");
    const dialog = await openChangeDialog();
    fill(dialog, DEMO_PASSWORD, NEW_PASSWORD);
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la contraseña nueva" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Por seguridad, esperá 2 minutos y probá de nuevo.",
    );
  });

  it("changes it and goes to the login, which says so and keeps the firm", async () => {
    const password = passwordRoutes(DEMO_ME, DEMO_PASSWORD);
    const requests = signedIn(DEMO_ME, { ...settingsRoutes().routes, ...password.routes });
    const { router, queryClient } = renderApp("/ajustes/usuarios");
    const dialog = await openChangeDialog();
    fill(dialog, DEMO_PASSWORD, NEW_PASSWORD);
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá la contraseña nueva" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Listo. Ingresá con tu contraseña nueva.");
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-demo");
    expect(router.state.location.search).toEqual({
      estudio: "estudio-demo",
      aviso: "contrasena-cambiada",
    });
    expect(passwordWrites(requests).map((request) => request.body)).toEqual([
      { currentPassword: DEMO_PASSWORD, newPassword: NEW_PASSWORD },
    ]);
    expect(password.state.changedTo).toBe(NEW_PASSWORD);
    expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(NEW_PASSWORD);
    expect(queryClient.getQueryData(["me"])).toBeNull();
  });
});

describe("the temporary password must be replaced", () => {
  const temporaryMe = { ...DEMO_ME, role: "PARALEGAL" as const, passwordChangeRequired: true };

  it("shows «Elegí tu contraseña» instead of the app, and nothing else is asked", async () => {
    const password = passwordRoutes(temporaryMe, TEMPORARY_PASSWORDS[0]!);
    const requests = signedIn(temporaryMe, password.routes);
    renderApp("/causas");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Elegí tu contraseña" }),
    ).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Lucía Ejemplo");
    expect(main).toHaveTextContent("Estudio Demo (ficticio)");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(within(main).getByLabelText("Contraseña temporal")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(within(main).getByLabelText("Contraseña nueva")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );

    fill(main, "abcd-0000-0000-zzzz", NEW_PASSWORD);
    fireEvent.click(within(main).getByRole("button", { name: "Guardá tu contraseña" }));
    expect(await within(main).findByRole("alert")).toHaveTextContent(
      "La contraseña temporal no es correcta.",
    );

    fill(main, TEMPORARY_PASSWORDS[0]!, NEW_PASSWORD);
    fireEvent.click(within(main).getByRole("button", { name: "Guardá tu contraseña" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Listo. Ingresá con tu contraseña nueva.");

    // Only /me, the CSRF token and the password change were asked: never the cases.
    expect(
      [...new Set(requests.map((request) => request.path))].filter(
        (path) => !["/api/v1/me", "/api/v1/auth/csrf", "/api/v1/me/password"].includes(path),
      ),
    ).toEqual([]);
  });

  it("lets the user sign out instead", async () => {
    const requests = signedIn(temporaryMe, {
      "POST /api/v1/auth/logout": () => new Response(null, { status: 204 }),
    });
    renderApp("/");
    fireEvent.click(await screen.findByRole("button", { name: "Cerrá la sesión" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.path === "/api/v1/auth/logout")).toBe(true);
  });

  it("moves to that screen when any request answers 403 password-change-required", async () => {
    let required = false;
    signedIn(DEMO_ME, {
      "GET /api/v1/me": () => json(200, { ...DEMO_ME, passwordChangeRequired: required }),
      "GET /api/v1/cases": () => {
        // The owner reset this user's password while the page was open.
        required = true;
        return problem(403, "password-change-required");
      },
    });
    renderApp("/causas");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Elegí tu contraseña" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 1, name: "Causas" })).toBeNull(),
    );
  });
});
