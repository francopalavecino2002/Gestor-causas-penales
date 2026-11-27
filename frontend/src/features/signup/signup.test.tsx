import { StrictMode } from "react";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app";
import { readRememberedFirms } from "@/features/firms/remembered-firms";
import { createQueryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";
import { json, problem, problemWith, signedOut } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

/** A fictitious token with the shape the backend issues: 43 base64url characters. */
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";
const PASSWORD = "una frase larga ficticia";
const SLUG = "estudio-ficticio-robles";
const EMAIL = "lucia.ficticia@ejemplo.test";

const ENABLED = {
  enabled: true,
  trialDays: 30,
  practiceAreas: [
    { code: "penal", name: "Penal" },
    { code: "civil", name: "Civil" },
  ],
};
const DISABLED = { enabled: false, trialDays: 0, practiceAreas: [] };

const settings = (body: unknown) => ({ "GET /api/v1/public/signup": () => json(200, body) });

const signupHeading = () =>
  screen.findByRole("heading", { level: 1, name: "Probá gratis 30 días" });
const loginHeading = () => screen.findByRole("heading", { level: 1, name: "Ingresá a tu estudio" });

function fillSignup({ password = PASSWORD, repeat }: { password?: string; repeat?: string } = {}) {
  repeat ??= password;
  fireEvent.change(screen.getByLabelText("Nombre del estudio"), {
    target: { value: "Estudio Ficticio Robles" },
  });
  fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Lucía Ficticia" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: ` ${EMAIL} ` } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Repetí la contraseña"), { target: { value: repeat } });
}

const create = () => fireEvent.click(screen.getByRole("button", { name: "Crear mi estudio" }));

describe("the login's sign-up link", () => {
  it("offers to try it for free when the server has sign-up on", async () => {
    signedOut(settings(ENABLED));
    renderApp("/ingresar");
    await loginHeading();

    expect(await screen.findByRole("link", { name: "Probá gratis" })).toHaveAttribute(
      "href",
      "/registro",
    );
  });

  it.each([
    ["sign-up is off", () => json(200, DISABLED)],
    ["the settings fail", () => problem(500, "internal")],
  ])("is hidden when %s", async (_case, answer) => {
    const requests = signedOut({ "GET /api/v1/public/signup": answer });
    renderApp("/ingresar");
    await loginHeading();

    await waitFor(() =>
      expect(requests.some((r) => r.path === "/api/v1/public/signup")).toBe(true),
    );
    expect(screen.queryByRole("link", { name: "Probá gratis" })).not.toBeInTheDocument();
  });

  it("says the email is not confirmed yet instead of the wrong-data message", async () => {
    const requests = signedOut({
      "POST /api/v1/auth/login": () => problem(403, "email-not-verified"),
    });
    renderApp(`/ingresar?estudio=${SLUG}`);
    await loginHeading();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresá" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Todavía no confirmaste tu email. Te mandamos un enlace nuevo: abrilo y volvé a ingresar.",
    );
    expect(requests.filter((r) => r.path === "/api/v1/auth/login")).toHaveLength(1);
  });
});

describe("signing up", () => {
  it("creates the firm with an empty honeypot and shows the identifier to log in with", async () => {
    const requests = signedOut({
      ...settings(ENABLED),
      "POST /api/v1/auth/signup": () => json(202, { tenant: SLUG, email: EMAIL }),
    });
    renderApp("/registro");
    await signupHeading();
    expect(screen.getByRole("checkbox", { name: "Penal" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Civil" })).not.toBeChecked();

    fillSignup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Civil" }));
    create();

    const sent = await screen.findByRole("heading", { level: 1, name: "Revisá tu email" });
    await waitFor(() => expect(sent).toHaveFocus());
    expect(screen.getByText(SLUG)).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText(/vence en 24 horas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a ingresar" })).toHaveAttribute(
      "href",
      `/ingresar?estudio=${SLUG}`,
    );

    const signup = requests.find((r) => r.path === "/api/v1/auth/signup");
    expect(signup?.headers["x-xsrf-token"]).toBe("token-1");
    expect(signup?.body).toEqual({
      firmName: "Estudio Ficticio Robles",
      practiceAreas: ["penal", "civil"],
      ownerName: "Lucía Ficticia",
      email: EMAIL,
      password: PASSWORD,
      website: "",
    });
    expect(readRememberedFirms()[0]).toEqual({
      slug: SLUG,
      name: "Estudio Ficticio Robles",
      lastEmail: EMAIL,
    });
  });

  it("keeps the honeypot out of reach of people", async () => {
    signedOut(settings(ENABLED));
    const { container } = renderApp("/registro");
    await signupHeading();

    const honeypot = container.querySelector<HTMLInputElement>("#signup-hp-check");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    // No name or label an autofill would recognize (website, url, homepage...).
    expect(honeypot?.name).not.toMatch(/web|url|site|home/i);
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "No completes este campo" })).not.toBeInTheDocument();
  });

  it("asks for at least one practice area before calling the server", async () => {
    const requests = signedOut(settings(ENABLED));
    renderApp("/registro");
    await signupHeading();

    fillSignup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Penal" }));
    create();

    expect(await screen.findByText("Elegí al menos un fuero.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Penal" })).toHaveFocus());
    expect(requests.some((r) => r.path === "/api/v1/auth/signup")).toBe(false);
  });

  it("checks both passwords match before calling the server", async () => {
    const requests = signedOut(settings(ENABLED));
    renderApp("/registro");
    await signupHeading();

    fillSignup({ repeat: "otra frase larga ficticia" });
    create();

    expect(
      await screen.findByText(
        "Las dos contraseñas nuevas no coinciden. Escribila igual en los dos campos.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Repetí la contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((r) => r.path === "/api/v1/auth/signup")).toBe(false);
  });

  it("says in Spanish what to check when the server rejects the data", async () => {
    signedOut({
      ...settings(ENABLED),
      "POST /api/v1/auth/signup": () =>
        problemWith(400, "invalid-signup", { detail: "The email is not valid" }),
    });
    renderApp("/registro");
    await signupHeading();

    fillSignup();
    create();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Revisá los datos");
    expect(alert).not.toHaveTextContent("The email is not valid");
  });

  it("says how long to wait after too many sign-ups", async () => {
    signedOut({
      ...settings(ENABLED),
      "POST /api/v1/auth/signup": () => problem(429, "signup-throttled", { "Retry-After": "300" }),
    });
    renderApp("/registro");
    await signupHeading();

    fillSignup();
    create();

    expect(await screen.findByRole("alert")).toHaveTextContent("esperá 5 minutos");
  });

  it("shows that sign-up is not available when the server has it off", async () => {
    const requests = signedOut(settings(DISABLED));
    renderApp("/registro");

    await screen.findByRole("heading", {
      level: 1,
      name: "El registro no está disponible por ahora",
    });
    expect(screen.queryByLabelText("Nombre del estudio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a ingresar" })).toHaveAttribute("href", "/ingresar");
    expect(requests.some((r) => r.path === "/api/v1/auth/signup")).toBe(false);
  });

  it("shows the same when sign-up was turned off before submitting (404)", async () => {
    signedOut({
      ...settings(ENABLED),
      "POST /api/v1/auth/signup": () => problem(404, "not-found"),
    });
    renderApp("/registro");
    await signupHeading();

    fillSignup();
    create();

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "El registro no está disponible por ahora",
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe("confirming the email with the link", () => {
  it("posts the token once, clears it from the address bar and opens the login", async () => {
    const requests = signedOut({
      "POST /api/v1/auth/email-verification": () =>
        json(200, { tenant: SLUG, firmName: "Estudio Ficticio Robles" }),
    });
    // StrictMode runs effects twice in development: the token must still be sent once.
    const queryClient = createQueryClient();
    const router = createAppRouter({
      queryClient,
      history: createMemoryHistory({
        initialEntries: [`/verificar-email?estudio=${SLUG}#token=${TOKEN}`],
      }),
    });
    render(
      <StrictMode>
        <App queryClient={queryClient} router={router} />
      </StrictMode>,
    );

    const done = await screen.findByRole("heading", {
      level: 1,
      name: "¡Listo! Ya confirmaste tu email.",
    });
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getByText("Estudio Ficticio Robles")).toBeInTheDocument();
    expect(screen.getByText(SLUG)).toBeInTheDocument();
    expect(router.state.location.hash).toBe("");
    expect(screen.getByRole("link", { name: "Ingresá a tu estudio" })).toHaveAttribute(
      "href",
      `/ingresar?estudio=${SLUG}`,
    );
    const posts = requests.filter((r) => r.path === "/api/v1/auth/email-verification");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({ token: TOKEN });
  });

  it("explains a used or expired link and how to get a new one", async () => {
    signedOut({
      "POST /api/v1/auth/email-verification": () => problem(400, "invalid-verification-token"),
    });
    renderApp(`/verificar-email?estudio=${SLUG}#token=${TOKEN}`);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "El enlace no es válido o ya venció",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(
      screen.getByText("Ingresá con tu email y contraseña y te mandamos uno nuevo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a ingresar" })).toHaveAttribute(
      "href",
      `/ingresar?estudio=${SLUG}`,
    );
  });

  it("shows the invalid link state without a token, without calling the server", async () => {
    const requests = signedOut();
    renderApp(`/verificar-email?estudio=${SLUG}`);

    await screen.findByRole("heading", { level: 1, name: "El enlace no es válido o ya venció" });
    expect(requests.some((r) => r.path === "/api/v1/auth/email-verification")).toBe(false);
  });

  it("says how long to wait after too many attempts and lets the user try again", async () => {
    let attempts = 0;
    signedOut({
      "POST /api/v1/auth/email-verification": () =>
        ++attempts === 1
          ? problem(429, "login-throttled", { "Retry-After": "120" })
          : json(200, { tenant: SLUG, firmName: "Estudio Ficticio Robles" }),
    });
    renderApp(`/verificar-email#token=${TOKEN}`);

    expect(await screen.findByRole("alert")).toHaveTextContent("esperá 2 minutos");
    fireEvent.click(screen.getByRole("button", { name: "Probá de nuevo" }));

    await screen.findByRole("heading", { level: 1, name: "¡Listo! Ya confirmaste tu email." });
    expect(attempts).toBe(2);
  });
});
