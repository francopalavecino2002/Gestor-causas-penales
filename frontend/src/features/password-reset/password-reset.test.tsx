import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readLinkToken } from "@/features/password-reset/reset-token";
import { DEMO_ME, noContent, problem, problemWith, signedIn, signedOut } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

/** A fictitious token with the shape the backend issues: 43 base64url characters. */
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";
const NEW_PASSWORD = "una frase larga ficticia";

const recoverHeading = () =>
  screen.findByRole("heading", { level: 1, name: "Recuperá tu contraseña" });
const resetHeading = () =>
  screen.findByRole("heading", { level: 1, name: "Elegí una contraseña nueva" });
const invalidHeading = () =>
  screen.findByRole("heading", { level: 1, name: "El enlace no es válido o venció" });

function askForLink(tenant = "estudio-demo", email = DEMO_ME.email) {
  fireEvent.change(screen.getByLabelText("Estudio"), { target: { value: tenant } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Enviame el enlace" }));
}

function choosePassword(first = NEW_PASSWORD, second = first) {
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: first } });
  fireEvent.change(screen.getByLabelText("Repetila"), { target: { value: second } });
  fireEvent.click(screen.getByRole("button", { name: "Guardá la contraseña nueva" }));
}

describe("the login's recovery link", () => {
  it("carries the firm already typed to the recovery screen", async () => {
    signedOut();
    const { router } = renderApp("/ingresar");
    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });

    fireEvent.change(screen.getByLabelText("Estudio"), { target: { value: " Estudio-Demo " } });
    const link = screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" });
    expect(link).toHaveAttribute("href", "/recuperar-clave?estudio=estudio-demo");

    fireEvent.click(link);

    await recoverHeading();
    expect(router.state.location.pathname).toBe("/recuperar-clave");
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-demo");
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("goes without a firm when none was typed", async () => {
    signedOut();
    renderApp("/ingresar");
    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });

    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute(
      "href",
      "/recuperar-clave",
    );
  });
});

describe("asking for a reset link", () => {
  it("sends the firm and the email and says what happens next without revealing the account", async () => {
    const requests = signedOut({ "POST /api/v1/auth/password-reset": () => noContent() });
    renderApp("/recuperar-clave");
    await recoverHeading();

    askForLink(" estudio-demo ", DEMO_ME.email);

    const sent = await screen.findByRole("heading", { level: 1, name: "Revisá tu correo" });
    await waitFor(() => expect(sent).toHaveFocus());
    expect(
      screen.getByText(
        "Si los datos corresponden a una cuenta, te mandamos un correo con un enlace. Vence en 30 minutos.",
      ),
    ).toBeInTheDocument();
    const reset = requests.find((r) => r.path === "/api/v1/auth/password-reset");
    expect(reset?.body).toEqual({ tenant: "estudio-demo", email: DEMO_ME.email });
    expect(reset?.headers["x-xsrf-token"]).toBe("token-1");
    expect(screen.getByRole("link", { name: "Volvé a ingresar" })).toHaveAttribute(
      "href",
      "/ingresar?estudio=estudio-demo",
    );
  });

  it("lets the user ask again with the same data", async () => {
    signedOut({ "POST /api/v1/auth/password-reset": () => noContent() });
    renderApp("/recuperar-clave");
    await recoverHeading();
    askForLink();
    await screen.findByRole("heading", { level: 1, name: "Revisá tu correo" });

    fireEvent.click(screen.getByRole("button", { name: "Pedí otro enlace" }));

    await recoverHeading();
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-demo");
    expect(screen.getByLabelText("Email")).toHaveValue(DEMO_ME.email);
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("validates the fields before calling the server", async () => {
    const requests = signedOut();
    renderApp("/recuperar-clave");
    await recoverHeading();

    askForLink("", "no-es-un-email");

    expect(await screen.findByText("Escribí el identificador de tu estudio.")).toBeInTheDocument();
    expect(
      screen.getByText("Revisá el email: tiene que tener la forma nombre@dominio.com."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((r) => r.path === "/api/v1/auth/password-reset")).toBe(false);
  });

  it("says how long to wait when too many links were asked for", async () => {
    signedOut({
      "POST /api/v1/auth/password-reset": () =>
        problem(429, "password-reset-throttled", { "Retry-After": "600" }),
    });
    renderApp("/recuperar-clave?estudio=estudio-demo");
    await recoverHeading();

    askForLink();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya pediste varios enlaces. Por seguridad, esperá 10 minutos antes de pedir otro.",
    );
    expect(screen.getByRole("button", { name: "Enviame el enlace" })).toBeEnabled();
  });

  it("sends signed-in users to the agenda", async () => {
    signedIn();
    const { router } = renderApp("/recuperar-clave");

    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("choosing a new password with the link", () => {
  it("takes the token out of the address bar, saves the password and opens the login", async () => {
    const requests = signedOut({ "POST /api/v1/auth/password-reset/confirm": () => noContent() });
    const { router } = renderApp(`/restablecer-clave?estudio=estudio-demo#token=${TOKEN}`);
    await resetHeading();
    await waitFor(() => expect(router.state.location.hash).toBe(""));
    expect(router.state.location.search).toEqual({ estudio: "estudio-demo" });

    choosePassword();

    await screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Listo, ya podés ingresar con tu nueva contraseña.",
    );
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-demo");
    expect(router.state.location.search).toEqual({
      estudio: "estudio-demo",
      aviso: "clave-restablecida",
    });
    expect(requests.find((r) => r.path === "/api/v1/auth/password-reset/confirm")?.body).toEqual({
      token: TOKEN,
      newPassword: NEW_PASSWORD,
    });
  });

  it("checks both passwords match before calling the server", async () => {
    const requests = signedOut();
    renderApp(`/restablecer-clave#token=${TOKEN}`);
    await resetHeading();

    choosePassword(NEW_PASSWORD, "otra frase larga ficticia");

    expect(
      await screen.findByText(
        "Las dos contraseñas nuevas no coinciden. Escribila igual en los dos campos.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Repetila")).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((r) => r.path.startsWith("/api/v1/auth/password-reset"))).toBe(false);
  });

  it("asks for at least 12 characters", async () => {
    signedOut();
    renderApp(`/restablecer-clave#token=${TOKEN}`);
    await resetHeading();

    choosePassword("corta");

    expect(
      await screen.findByText("La contraseña nueva tiene que tener al menos 12 caracteres."),
    ).toBeInTheDocument();
  });

  it("explains a used or expired link and offers a new one", async () => {
    signedOut({
      "POST /api/v1/auth/password-reset/confirm": () => problem(400, "invalid-reset-token"),
    });
    renderApp(`/restablecer-clave?estudio=estudio-demo#token=${TOKEN}`);
    await resetHeading();

    choosePassword();

    const heading = await invalidHeading();
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("link", { name: "Pedí un enlace nuevo" })).toHaveAttribute(
      "href",
      "/recuperar-clave?estudio=estudio-demo",
    );
  });

  it("shows the invalid link state without a token, without calling the server", async () => {
    const requests = signedOut();
    renderApp("/restablecer-clave?estudio=estudio-demo");

    await invalidHeading();
    expect(screen.queryByLabelText("Nueva contraseña")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volvé a ingresar" })).toHaveAttribute(
      "href",
      "/ingresar?estudio=estudio-demo",
    );
    expect(requests.some((r) => r.path.startsWith("/api/v1/auth/password-reset"))).toBe(false);
  });

  it("points at the new password when the server rejects it", async () => {
    signedOut({
      "POST /api/v1/auth/password-reset/confirm": () =>
        problemWith(400, "invalid-password", {
          detail: "Password must have at least 12 characters",
        }),
    });
    renderApp(`/restablecer-clave#token=${TOKEN}`);
    await resetHeading();

    choosePassword();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La contraseña nueva tiene que tener al menos 12 caracteres.",
    );
    expect(screen.getByLabelText("Nueva contraseña")).toHaveValue("");
    await waitFor(() => expect(screen.getByLabelText("Nueva contraseña")).toHaveFocus());
  });

  it("says how long to wait after too many attempts", async () => {
    signedOut({
      "POST /api/v1/auth/password-reset/confirm": () =>
        problem(429, "login-throttled", { "Retry-After": "120" }),
    });
    renderApp(`/restablecer-clave#token=${TOKEN}`);
    await resetHeading();

    choosePassword();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Por seguridad, esperá 2 minutos y probá de nuevo.",
    );
  });
});

describe("readLinkToken", () => {
  it("reads a well-formed token from the fragment", () => {
    expect(readLinkToken(`#token=${TOKEN}`)).toBe(TOKEN);
    expect(readLinkToken(`token=${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    ["no fragment", ""],
    ["another key", `#otro=${TOKEN}`],
    ["too short", "#token=abc"],
    ["not base64url", `#token=${TOKEN.slice(0, 42)}+`],
  ])("ignores %s", (_case, hash) => {
    expect(readLinkToken(hash)).toBeUndefined();
  });
});
