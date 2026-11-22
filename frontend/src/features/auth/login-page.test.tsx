import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { readRememberedFirms, rememberFirm } from "@/features/firms/remembered-firms";
import {
  DEMO_ME,
  json,
  mockFetch,
  noContent,
  problem,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

/** /me answers 401 until a login (and the second factor, if asked) succeeds. */
function fakeBackend(
  options: {
    login?: (request: RecordedRequest) => Response;
    secondFactor?: (request: RecordedRequest) => Response;
  } = {},
) {
  let signedInNow = false;
  return mockFetch({
    "GET /api/v1/me": () =>
      signedInNow ? json(200, DEMO_ME) : problem(401, "authentication-required"),
    "POST /api/v1/auth/login": (request) => {
      const response = options.login?.(request) ?? noContent();
      if (response.status === 204) signedInNow = true;
      return response;
    },
    "POST /api/v1/auth/login/second-factor": (request) => {
      const response = options.secondFactor?.(request) ?? noContent();
      if (response.status === 204) signedInNow = true;
      return response;
    },
  });
}

function fillCredentials(
  values = { tenant: "estudio-demo", email: DEMO_ME.email, password: "secreta" },
) {
  fireEvent.change(screen.getByLabelText("Estudio"), { target: { value: values.tenant } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: values.password } });
  fireEvent.click(screen.getByRole("button", { name: "Ingresá" }));
}

const loginHeading = () => screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });

describe("login", () => {
  it("sends anonymous visitors to the login and back to the page they asked for", async () => {
    const requests = fakeBackend();
    const { router } = renderApp("/causas");

    await loginHeading();
    expect(router.state.location.pathname).toBe("/ingresar");
    expect(router.state.location.search).toEqual({ redirect: "/causas" });

    fillCredentials();

    expect(await screen.findByRole("heading", { level: 1, name: "Causas" })).toBeInTheDocument();
    const login = requests.find((r) => r.path === "/api/v1/auth/login");
    expect(login?.body).toEqual({
      tenant: "estudio-demo",
      email: DEMO_ME.email,
      password: "secreta",
    });
    expect(login?.headers["x-xsrf-token"]).toBe("token-1");
    expect(readRememberedFirms()).toEqual([
      { slug: "estudio-demo", name: DEMO_ME.tenant.name, lastEmail: DEMO_ME.email },
    ]);
  });

  it("validates the fields before calling the server", async () => {
    const requests = fakeBackend();
    renderApp("/ingresar");
    await loginHeading();

    fireEvent.click(screen.getByRole("button", { name: "Ingresá" }));

    expect(await screen.findByText("Escribí el identificador de tu estudio.")).toBeInTheDocument();
    expect(screen.getByText("Escribí tu email.")).toBeInTheDocument();
    expect(screen.getByText("Escribí tu contraseña.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((r) => r.path === "/api/v1/auth/login")).toBe(false);
  });

  it("asks for the code when the account has two-step verification", async () => {
    const requests = fakeBackend({
      login: () => json(202, { status: "SECOND_FACTOR_REQUIRED" }),
    });
    renderApp("/ingresar");
    await loginHeading();

    fillCredentials();

    const code = await screen.findByLabelText("Código de verificación");
    expect(
      screen.getByRole("heading", { level: 1, name: "Confirmá que sos vos" }),
    ).toBeInTheDocument();
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");

    fireEvent.change(code, { target: { value: "123 456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verificá el código" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" }),
    ).toBeInTheDocument();
    expect(requests.find((r) => r.path === "/api/v1/auth/login/second-factor")?.body).toEqual({
      code: "123456",
    });
  });

  it("accepts a recovery code instead of the app code", async () => {
    const requests = fakeBackend({
      login: () => json(202, { status: "SECOND_FACTOR_REQUIRED" }),
    });
    renderApp("/ingresar");
    await loginHeading();
    fillCredentials();
    await screen.findByLabelText("Código de verificación");

    fireEvent.click(screen.getByRole("button", { name: "Usar un código de recuperación" }));
    fireEvent.change(screen.getByLabelText("Código de recuperación"), {
      target: { value: "abcd-efgh-jkmn-pqrs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificá el código" }));

    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    expect(requests.find((r) => r.path === "/api/v1/auth/login/second-factor")?.body).toEqual({
      code: "ABCD-EFGH-JKMN-PQRS",
    });
  });

  it("says the code is wrong and lets the user try again", async () => {
    fakeBackend({
      login: () => json(202, { status: "SECOND_FACTOR_REQUIRED" }),
      secondFactor: () => problem(401, "invalid-second-factor"),
    });
    renderApp("/ingresar");
    await loginHeading();
    fillCredentials();
    fireEvent.change(await screen.findByLabelText("Código de verificación"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificá el código" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El código no es válido");
    expect(screen.getByLabelText("Código de verificación")).toHaveValue("");
  });

  it("gives one generic message for wrong credentials and clears the password", async () => {
    fakeBackend({ login: () => problem(401, "invalid-credentials") });
    renderApp("/ingresar");
    await loginHeading();

    fillCredentials();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Los datos no coinciden con una cuenta activa. Revisá el estudio, el email y la contraseña",
    );
    expect(screen.getByLabelText("Email")).toHaveValue(DEMO_ME.email);
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("says how long to wait when logins are throttled", async () => {
    fakeBackend({ login: () => problem(429, "login-throttled", { "Retry-After": "95" }) });
    renderApp("/ingresar");
    await loginHeading();

    fillCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hubo demasiados intentos fallidos. Por seguridad, esperá 2 minutos y probá de nuevo.",
    );
  });

  it("goes back to the password when the code step expired", async () => {
    fakeBackend({
      login: () => json(202, { status: "SECOND_FACTOR_REQUIRED" }),
      secondFactor: () => problem(401, "second-factor-expired"),
    });
    renderApp("/ingresar");
    await loginHeading();
    fillCredentials();
    fireEvent.change(await screen.findByLabelText("Código de verificación"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificá el código" }));

    await loginHeading();
    expect(screen.getByRole("alert")).toHaveTextContent("Pasó demasiado tiempo");
    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-demo");
    expect(screen.getByLabelText("Email")).toHaveValue(DEMO_ME.email);
  });

  it("explains a network failure", async () => {
    fakeBackend({ login: () => problem(404, "x") });
    renderApp("/ingresar");
    await loginHeading();
    // From now on the server cannot be reached.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    fillCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos conectar con el servidor. Revisá tu conexión a internet",
    );
  });

  it("prefills the firm and the remembered email from ?estudio=", async () => {
    fakeBackend();
    rememberFirm({
      slug: "estudio-norte",
      name: "Estudio Norte (ficticio)",
      lastEmail: "ana@example.com",
    });
    renderApp("/ingresar?estudio=estudio-norte");
    await loginHeading();

    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-norte");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    await waitFor(() => expect(screen.getByLabelText("Contraseña")).toHaveFocus());
  });

  it("offers the firms used on this device", async () => {
    fakeBackend();
    rememberFirm({
      slug: "estudio-norte",
      name: "Estudio Norte (ficticio)",
      lastEmail: "ana@example.com",
    });
    renderApp("/ingresar");
    await loginHeading();

    fireEvent.click(screen.getByRole("button", { name: /Estudio Norte \(ficticio\)/ }));

    expect(screen.getByLabelText("Estudio")).toHaveValue("estudio-norte");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("sends signed-in users from the login to the agenda", async () => {
    signedIn();
    const { router } = renderApp("/ingresar");

    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("ignores redirects to other sites", async () => {
    fakeBackend();
    const { router } = renderApp("/ingresar?redirect=//malicioso.example");
    await loginHeading();

    fillCredentials();

    await screen.findByRole("heading", { level: 1, name: "Audiencias de hoy" });
    expect(router.state.location.pathname).toBe("/");
  });
});
