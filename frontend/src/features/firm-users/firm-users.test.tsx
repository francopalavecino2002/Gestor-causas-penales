import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FIRM_USERS, TEMPORARY_PASSWORDS } from "@/test/firm-user-fixtures";
import { DEMO_ME, firmUserRoutes, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";

type Handler = (request: RecordedRequest) => Response | Promise<Response>;

const PAULA = FIRM_USERS.find((user) => user.displayName === "Paula Demo")!;
const HUGO = FIRM_USERS.find((user) => user.displayName === "Hugo Prueba")!;

const writes = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method !== "GET")
    .map((request) => `${request.method} ${request.path}`);

/** Signed in as the owner at Ajustes → Usuarios, over the stateful fictitious users. */
function openUsers(routes: Record<string, Handler> = {}) {
  const firm = firmUserRoutes();
  const requests = signedIn(DEMO_ME, { ...settingsRoutes().routes, ...firm.routes, ...routes });
  const app = renderApp("/ajustes/usuarios");
  return { requests, users: firm.users, ...app };
}

const section = () => screen.findByRole("region", { name: "Personas del estudio" });

async function card(name: string) {
  return within(await section()).findByRole("article", { name });
}

async function openAction(person: string, button: string, title: string | RegExp) {
  fireEvent.click(within(await card(person)).getByRole("button", { name: button }));
  return screen.findByRole("dialog", { name: title });
}

function stubClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
  });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

async function fillNewUser(name: string, email: string, role: string) {
  const dialog = await screen.findByRole("dialog", { name: "Sumá una persona al estudio" });
  fireEvent.change(within(dialog).getByLabelText("Nombre y apellido"), {
    target: { value: name },
  });
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(within(dialog).getByLabelText("Rol"), { target: { value: role } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Creá la cuenta" }));
  return dialog;
}

describe("Ajustes → Usuarios: the owner manages the firm's people", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  it("lists the people with role and security, hides the archived until asked, and leaves the own account alone", async () => {
    openUsers();
    const region = await section();
    const list = await within(region).findByRole("list", { name: "Personas del estudio" });
    expect(
      within(list)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Hugo Prueba", "Lucía EjemploVos", "Paula Demo", "Tomás Muestra"]);

    const hugo = await card("Hugo Prueba");
    expect(hugo).toHaveTextContent("hugo.prueba@ejemplo.test");
    expect(hugo).toHaveTextContent("RolAbogado/a");
    expect(hugo).toHaveTextContent("Dos pasos activada");
    expect(await card("Paula Demo")).toHaveTextContent("Dos pasos desactivada");
    expect(await card("Tomás Muestra")).toHaveTextContent("Debe cambiar la contraseña");

    // The owner's own row says so and offers nothing: their account is changed in «Tu cuenta».
    const own = await card("Lucía Ejemplo");
    expect(within(own).getByText("Vos")).toBeInTheDocument();
    expect(within(own).queryByRole("button")).not.toBeInTheDocument();
    expect(own).toHaveTextContent("Tu cuenta: cambiá tu contraseña arriba");
    // The old "coming soon" note is gone.
    expect(document.body).not.toHaveTextContent("llega con una próxima versión");

    expect(within(region).queryByRole("article", { name: "Sofía Muestra" })).toBeNull();
    fireEvent.click(within(region).getByRole("switch", { name: "Mostrá las archivadas (1)" }));
    const sofia = await card("Sofía Muestra");
    expect(sofia).toHaveTextContent("Archivada");
    expect(
      within(sofia)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Restaurá"]);
  });

  it("creates a user and shows the temporary password once, behind a close guard", async () => {
    const { requests, queryClient } = openUsers();
    const writeText = stubClipboard();

    fireEvent.click(within(await section()).getByRole("button", { name: "Sumá una persona" }));
    const dialog = await screen.findByRole("dialog", { name: "Sumá una persona al estudio" });

    // Nothing is sent until the three fields are right.
    fireEvent.click(within(dialog).getByRole("button", { name: "Creá la cuenta" }));
    expect(await within(dialog).findByText("Escribí el nombre y el apellido.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribí el email con el que va a ingresar.")).toBeVisible();
    expect(within(dialog).getByText("Elegí el rol.")).toBeVisible();
    expect(within(dialog).getByLabelText("Nombre y apellido")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // The chosen role says what it can do.
    fireEvent.change(within(dialog).getByLabelText("Rol"), { target: { value: "PARALEGAL" } });
    expect(await within(dialog).findByText("Qué puede hacer el rol Procurador/a")).toBeVisible();
    expect(dialog).toHaveTextContent("Carga y edita causas, imputados, personas y audiencias.");

    await fillNewUser("Rocío Ficticia", "Rocio.Ficticia@ejemplo.test", "PARALEGAL");

    const shown = await screen.findByRole("dialog", {
      name: "Contraseña temporal de Rocío Ficticia",
    });
    expect(shown).toHaveTextContent("Creaste la cuenta de Rocío Ficticia.");
    expect(within(shown).getByText(TEMPORARY_PASSWORDS[0]!)).toBeInTheDocument();
    expect(shown).toHaveTextContent("Se muestra una sola vez");
    expect(shown).toHaveTextContent(
      "Dásela en persona o por un canal seguro; al ingresar va a tener que elegir la suya.",
    );
    expect(shown).toHaveTextContent("Estudioestudio-demo");
    expect(shown).toHaveTextContent("Emailrocio.ficticia@ejemplo.test");

    fireEvent.click(within(shown).getByRole("button", { name: "Copiá la contraseña" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TEMPORARY_PASSWORDS[0]));
    expect(await within(shown).findByText(/Copiaste la contraseña/)).toBeInTheDocument();

    // Closing before ticking the box keeps it open and says why.
    fireEvent.click(within(shown).getByRole("button", { name: "Listo" }));
    expect(await within(shown).findByRole("alert")).toHaveTextContent(
      /Antes de cerrar, anotá o copiá la contraseña de Rocío Ficticia/,
    );
    fireEvent.keyDown(shown, { key: "Escape" });
    fireEvent.click(within(shown).getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const box = within(shown).getByRole("checkbox", { name: "Ya la anoté" });
    expect(box).toHaveFocus();

    fireEvent.click(box);
    fireEvent.click(within(shown).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // The list shows the new person; the password is gone from the page and every cache.
    const rocio = await card("Rocío Ficticia");
    expect(rocio).toHaveTextContent("Debe cambiar la contraseña");
    expect(rocio).toHaveTextContent("RolProcurador/a");
    expect(await section()).toHaveTextContent("Creaste la cuenta de Rocío Ficticia.");
    expect(screen.getByRole("heading", { name: "Personas del estudio" })).toHaveFocus();
    expect(document.body).not.toHaveTextContent(TEMPORARY_PASSWORDS[0]!);
    const caches = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ]);
    expect(caches).not.toContain(TEMPORARY_PASSWORDS[0]);
    expect(window.localStorage.length).toBe(0);

    const create = requests.find((request) => request.method === "POST");
    expect(create?.body).toEqual({
      displayName: "Rocío Ficticia",
      email: "Rocio.Ficticia@ejemplo.test",
      role: "PARALEGAL",
    });
  });

  it("marks the email when it is already used in the firm (409)", async () => {
    const { requests } = openUsers();
    fireEvent.click(within(await section()).getByRole("button", { name: "Sumá una persona" }));
    const dialog = await fillNewUser("Otra Paula", "PAULA.demo@ejemplo.test", "LAWYER");

    const email = within(dialog).getByLabelText("Email");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(dialog).toHaveTextContent("Ya hay una cuenta con ese email en el estudio.");
    expect(email.getAttribute("aria-describedby")).toContain("email-error");
    expect(email).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Sumá una persona al estudio" })).toBeVisible();
    expect(writes(requests)).toEqual(["POST /api/v1/firm/users"]);
  });

  it("changes a role, saying that the person will sign in again", async () => {
    const { requests } = openUsers();
    const dialog = await openAction("Paula Demo", "Cambiá el rol", "Cambiá el rol de Paula Demo");
    expect(dialog).toHaveTextContent("Hoy tiene el rol Abogado/a.");
    expect(dialog).toHaveTextContent("sale del sistema en todos sus dispositivos");
    const save = within(dialog).getByRole("button", { name: "Guardá el rol" });
    expect(save).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Rol nuevo"), { target: { value: "OWNER" } });
    expect(within(dialog).getByText("Qué puede hacer el rol Titular")).toBeVisible();
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(await section()).toHaveTextContent("Listo: Paula Demo ahora tiene el rol Titular.");
    await waitFor(async () => expect(await card("Paula Demo")).toHaveTextContent("RolTitular"));
    const put = requests.find((request) => request.method === "PUT");
    expect(put?.path).toBe(`/api/v1/firm/users/${PAULA.id}/role`);
    expect(put?.body).toEqual({ role: "OWNER" });
  });

  it("archives after confirming, and restores from the archived ones", async () => {
    const { requests } = openUsers();
    let dialog = await openAction("Paula Demo", "Archivá", "¿Archivás la cuenta de Paula Demo?");
    expect(dialog).toHaveTextContent("No se borra nada");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes(requests)).toEqual([]);

    dialog = await openAction("Paula Demo", "Archivá", "¿Archivás la cuenta de Paula Demo?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Archivá la cuenta" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const region = await section();
    expect(region).toHaveTextContent("Archivaste la cuenta de Paula Demo.");
    await waitFor(() =>
      expect(within(region).queryByRole("article", { name: "Paula Demo" })).toBeNull(),
    );

    fireEvent.click(within(region).getByRole("switch", { name: "Mostrá las archivadas (2)" }));
    fireEvent.click(within(await card("Paula Demo")).getByRole("button", { name: "Restaurá" }));
    expect(
      await within(region).findByText(
        "Restauraste la cuenta de Paula Demo. Ya puede ingresar con su contraseña de siempre.",
      ),
    ).toBeInTheDocument();
    await waitFor(async () => expect(await card("Paula Demo")).not.toHaveTextContent("Archivada"));
    expect(writes(requests)).toEqual([
      `POST /api/v1/firm/users/${PAULA.id}/archive`,
      `POST /api/v1/firm/users/${PAULA.id}/restore`,
    ]);
  });

  it("explains the last-owner refusal (409) and keeps the person as they were", async () => {
    openUsers({
      [`POST /api/v1/firm/users/${HUGO.id}/archive`]: () => problem(409, "last-owner"),
    });
    const dialog = await openAction(
      "Hugo Prueba",
      "Archivá",
      "¿Archivás la cuenta de Hugo Prueba?",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Archivá la cuenta" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El estudio necesita al menos una persona titular activa.",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("refreshes the list when the server says it is the owner's own account (409)", async () => {
    const { requests } = openUsers({
      [`PUT /api/v1/firm/users/${HUGO.id}/role`]: () => problem(409, "own-account"),
    });
    const dialog = await openAction("Hugo Prueba", "Cambiá el rol", "Cambiá el rol de Hugo Prueba");
    fireEvent.change(within(dialog).getByLabelText("Rol nuevo"), {
      target: { value: "PARALEGAL" },
    });
    const before = requests.filter((request) => request.path === "/api/v1/firm/users").length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardá el rol" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tu propia cuenta no se cambia desde acá",
    );
    await waitFor(() =>
      expect(requests.filter((request) => request.path === "/api/v1/firm/users").length).toBe(
        before + 1,
      ),
    );
  });

  it("gives a new temporary password after confirming, shown once", async () => {
    const { requests, users } = openUsers();
    const dialog = await openAction(
      "Paula Demo",
      "Contraseña temporal",
      "¿Generás una contraseña temporal nueva para Paula Demo?",
    );
    expect(dialog).toHaveTextContent("La contraseña que usa ahora deja de funcionar");
    fireEvent.click(within(dialog).getByRole("button", { name: "Generá la contraseña" }));

    const shown = await screen.findByRole("dialog", { name: "Contraseña temporal de Paula Demo" });
    expect(within(shown).getByText(TEMPORARY_PASSWORDS[0]!)).toBeInTheDocument();
    expect(shown).toHaveTextContent("La contraseña que usaba hasta ahora ya no funciona.");
    fireEvent.keyDown(shown, { key: "Escape" });
    expect(await within(shown).findByRole("alert")).toHaveTextContent(/Antes de cerrar/);

    fireEvent.click(within(shown).getByRole("checkbox", { name: "Ya la anoté" }));
    fireEvent.click(within(shown).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await card("Paula Demo")).toHaveTextContent("Debe cambiar la contraseña");
    expect(await section()).toHaveTextContent(
      "Generaste una contraseña temporal nueva para Paula Demo.",
    );
    expect(document.body).not.toHaveTextContent(TEMPORARY_PASSWORDS[0]!);
    expect(users.find((user) => user.id === PAULA.id)?.passwordChangeRequired).toBe(true);
    expect(writes(requests)).toEqual([`POST /api/v1/firm/users/${PAULA.id}/password-reset`]);
  });

  it("shows an error with a retry when the list does not load", async () => {
    openUsers({ "GET /api/v1/firm/users": () => new Response(null, { status: 500 }) });
    const region = await section();
    expect(await within(region).findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "No pudimos cargar las personas del estudio",
    );
    expect(within(region).getByRole("button", { name: "Volvé a intentar" })).toBeInTheDocument();
  });

  it.each(["LAWYER", "PARALEGAL", "ADMIN_STAFF"] as const)(
    "shows no list to the %s role, only who manages it",
    async (role) => {
      const requests = signedIn({ ...DEMO_ME, role }, settingsRoutes().routes);
      renderApp("/ajustes/usuarios");
      const region = await section();
      expect(region).toHaveTextContent(
        "Las cuentas del equipo las maneja la persona titular del estudio",
      );
      expect(within(region).queryByRole("button")).not.toBeInTheDocument();
      expect(requests.some((request) => request.path === "/api/v1/firm/users")).toBe(false);
    },
  );
});
