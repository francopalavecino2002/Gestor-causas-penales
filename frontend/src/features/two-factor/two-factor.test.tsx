import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_ME, signedIn, twoFactorRoutes, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { settingsRoutes } from "@/test/settings-mock";
import {
  DEMO_OTPAUTH_URI,
  DEMO_PASSWORD,
  DEMO_TOTP_CODE,
  demoRecoveryCodes,
} from "@/test/two-factor-fixtures";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET").map((request) => request.path);

function stubClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
  });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

/**
 * Signed in at Ajustes → Usuarios with the stateful two-factor backend. With `hold`, the POST to
 * that path waits until `release()` is called, to act while the request is in flight.
 */
function openUsers(initial: Parameters<typeof twoFactorRoutes>[0] = {}, hold?: string) {
  const twoFactor = twoFactorRoutes(initial);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const post = twoFactor.routes["POST /api/v1/me/two-factor/*"]!;
  const requests = signedIn(
    { ...DEMO_ME, twoFactorEnabled: initial.enabled ?? false },
    {
      ...settingsRoutes().routes,
      ...twoFactor.routes,
      "POST /api/v1/me/two-factor/*": async (request) => {
        if (request.path === hold) await gate;
        return post(request);
      },
    },
  );
  const app = renderApp("/ajustes/usuarios");
  return { requests, state: twoFactor.state, release, ...app };
}

/** Escape, the "Cerrar" button and a tap outside: none of them closes the dialog. */
function tryToClose(dialog: HTMLElement) {
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
  fireEvent.pointerDown(document.body);
}

async function reachCodeStep() {
  await startEnrollment();
  fireEvent.click(await screen.findByRole("button", { name: "Ya la agregué, continuá" }));
  return screen.findByRole("dialog", { name: "Escribí el código de la app" });
}

async function openEnabledAction(name: string, title: string) {
  fireEvent.click(await within(await section()).findByRole("button", { name }));
  return screen.findByRole("dialog", { name: title });
}

function fillDisable(dialog: HTMLElement, password: string, code: string) {
  fireEvent.change(within(dialog).getByLabelText("Tu contraseña"), {
    target: { value: password },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Código de/), { target: { value: code } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá la verificación" }));
}

async function section() {
  return screen.findByRole("region", { name: "Verificación en dos pasos" });
}

async function startEnrollment(password = DEMO_PASSWORD) {
  fireEvent.click(
    await within(await section()).findByRole("button", {
      name: "Activá la verificación en dos pasos",
    }),
  );
  const dialog = await screen.findByRole("dialog", { name: "Confirmá que sos vos" });
  fireEvent.change(within(dialog).getByLabelText("Tu contraseña"), {
    target: { value: password },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continuá" }));
  return dialog;
}

async function confirmCode(code: string) {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
    target: { value: code },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Activá la verificación" }));
}

describe("two-factor self-service", () => {
  let downloads: { name: string; blob: Blob }[];

  beforeEach(() => {
    downloads = [];
    let pending: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      pending = blob;
      return "blob:codigos";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      if (pending) downloads.push({ name: this.download, blob: pending });
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  it("enrolls with the QR and the manual key, confirms, and shows the codes once behind a close guard", async () => {
    const { requests, queryClient } = openUsers();
    const writeText = stubClipboard();

    const region = await section();
    expect(await within(region).findByText("Desactivada")).toBeInTheDocument();
    await startEnrollment();

    // Step 2: the QR is drawn in the browser from the otpauth address, and the key is grouped.
    const scan = await screen.findByRole("dialog", { name: "Agregá tu cuenta a la app" });
    expect(within(scan).getByText("Paso 2 de 4")).toBeInTheDocument();
    expect(
      within(scan).getByRole("img", {
        name: "Código QR para agregar tu cuenta a la app de autenticación",
      }).tagName,
    ).toBe("svg");
    expect(scan.querySelector("img")).toBeNull();
    expect(
      within(scan).getByRole("link", { name: "Abrí la app de autenticación" }),
    ).toHaveAttribute("href", DEMO_OTPAUTH_URI);
    const key = within(scan).getByText(
      "Si no podés usar el código QR, escribí esta clave en la app",
    ).nextElementSibling as HTMLElement;
    expect([...key.children].map((group) => group.textContent)).toEqual([
      "GEZD",
      "GNBV",
      "GY3T",
      "QOJQ",
      "GEZD",
      "GNBV",
      "GY3T",
      "QOJQ",
    ]);
    expect(scan).toHaveTextContent(/Google Authenticator, Microsoft Authenticator/);
    fireEvent.click(within(scan).getByRole("button", { name: "Copiá la clave" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"));
    fireEvent.click(within(scan).getByRole("button", { name: "Ya la agregué, continuá" }));

    // Step 3: a numeric one-time-code field.
    const codeDialog = await screen.findByRole("dialog", { name: "Escribí el código de la app" });
    const input = within(codeDialog).getByLabelText("Código de 6 números");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await waitFor(() => expect(input).toHaveFocus());
    await confirmCode(DEMO_TOTP_CODE);

    // Step 4: the ten codes, once.
    const codes = await screen.findByRole("dialog", { name: "Guardá tus códigos de recuperación" });
    const list = within(codes).getByRole("list", { name: "Códigos de recuperación" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(list).toHaveTextContent(demoRecoveryCodes(1)[0]!);
    expect(codes).toHaveTextContent("Activaste la verificación en dos pasos.");

    fireEvent.click(within(codes).getByRole("button", { name: "Descargá los códigos" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.name).toBe("codigos-recuperacion-gestor.txt");
    const text = await downloads[0]!.blob.text();
    for (const code of demoRecoveryCodes(1)) expect(text).toContain(code);
    expect(text).toContain("Cada código sirve una sola vez");

    fireEvent.click(within(codes).getByRole("button", { name: "Copiá los códigos" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        demoRecoveryCodes(1)
          .map((code, index) => `${index + 1}. ${code}`)
          .join("\r\n"),
      ),
    );

    // Closing before ticking the box keeps the dialog open and says why.
    fireEvent.click(within(codes).getByRole("button", { name: "Listo" }));
    expect(await within(codes).findByRole("alert")).toHaveTextContent(
      /Antes de cerrar, descargá o copiá los códigos/,
    );
    fireEvent.keyDown(codes, { key: "Escape" });
    fireEvent.click(within(codes).getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const box = within(codes).getByRole("checkbox", { name: "Ya los guardé en un lugar seguro" });
    expect(box).toHaveFocus();

    fireEvent.click(box);
    fireEvent.click(within(codes).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // The screen and the account badge follow; nothing of the codes is kept anywhere.
    expect(await within(region).findByText("Activada")).toBeInTheDocument();
    expect(region).toHaveTextContent("Listo: activaste la verificación en dos pasos.");
    expect(region).toHaveTextContent("Te quedan 10 códigos de recuperación sin usar.");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Tu cuenta" })).toHaveTextContent(
        "Verificación en dos pasosActivada",
      ),
    );
    expect(screen.getByRole("heading", { name: "Verificación en dos pasos" })).toHaveFocus();
    expect(document.body).not.toHaveTextContent(demoRecoveryCodes(1)[0]!);
    expect(
      JSON.stringify(
        queryClient
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ),
    ).not.toMatch(/FAKE-|GEZD|una-clave/);
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toMatch(/FAKE-|GEZD/);
    expect(window.localStorage.length).toBe(0);
    expect(writes(requests)).toEqual([
      "/api/v1/me/two-factor/enrollment",
      "/api/v1/me/two-factor/enrollment/confirm",
    ]);
  });

  it("says when the password is wrong, and ties the message to the field", async () => {
    openUsers();
    const dialog = await startEnrollment("otra-clave");

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("La contraseña no es correcta.");
    const field = within(dialog).getByLabelText("Tu contraseña");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain(alert.id);
    expect(field).toHaveValue("");
  });

  it("rejects a wrong code (422) and lets the user try again", async () => {
    const { state } = openUsers();
    await startEnrollment();
    fireEvent.click(await screen.findByRole("button", { name: "Ya la agregué, continuá" }));
    await screen.findByRole("dialog", { name: "Escribí el código de la app" });

    await confirmCode("111111");
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El código no es correcto o ya cambió.",
    );
    const input = within(dialog).getByLabelText("Código de 6 números");
    expect(input).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(input).toHaveFocus());
    expect(state.enabled).toBe(false);

    await confirmCode(DEMO_TOTP_CODE);
    expect(
      await screen.findByRole("dialog", { name: "Guardá tus códigos de recuperación" }),
    ).toBeInTheDocument();
  });

  it("validates the code before sending it", async () => {
    const { requests } = openUsers();
    await startEnrollment();
    fireEvent.click(await screen.findByRole("button", { name: "Ya la agregué, continuá" }));
    await screen.findByRole("dialog", { name: "Escribí el código de la app" });
    await confirmCode("12ab");
    expect(
      await screen.findByText("Escribí los 6 números que muestra tu app."),
    ).toBeInTheDocument();
    expect(writes(requests)).toEqual(["/api/v1/me/two-factor/enrollment"]);
  });

  it("says how long to wait when there were too many attempts (429)", async () => {
    openUsers({ throttled: true });
    const dialog = await startEnrollment();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Esperá 2 minutos y probá de nuevo.",
    );
  });

  it("regenerates the codes with a recovery code and shows the new ones once", async () => {
    const { requests } = openUsers({ enabled: true, remaining: 2 });

    const region = await section();
    expect(
      await within(region).findByText("Te quedan 2 códigos de recuperación sin usar."),
    ).toBeInTheDocument();
    expect(region).toHaveTextContent("Generá códigos nuevos antes de quedarte sin ninguno");

    fireEvent.click(within(region).getByRole("button", { name: "Generá códigos nuevos" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Generás códigos nuevos?" });
    expect(dialog).toHaveTextContent("los que tenés ahora dejan de funcionar");

    fireEvent.click(within(dialog).getByRole("button", { name: "Usá un código de recuperación" }));
    fireEvent.change(within(dialog).getByLabelText("Código de recuperación"), {
      target: { value: demoRecoveryCodes(0)[0]!.toLowerCase() },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generá los códigos nuevos" }));

    const fresh = await screen.findByRole("dialog", { name: "Guardá tus códigos nuevos" });
    expect(fresh).toHaveTextContent(demoRecoveryCodes(1)[9]!);
    expect(fresh).toHaveTextContent("Los códigos que tenías antes ya no funcionan.");
    fireEvent.click(
      within(fresh).getByRole("checkbox", { name: "Ya los guardé en un lugar seguro" }),
    );
    fireEvent.click(within(fresh).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(
      await within(region).findByText("Te quedan 10 códigos de recuperación sin usar."),
    ).toBeInTheDocument();
    expect(region).toHaveTextContent("Los anteriores ya no funcionan.");
    expect(writes(requests)).toEqual(["/api/v1/me/two-factor/recovery-codes"]);
  });

  it("disables with the password and a code, after explaining the risk", async () => {
    const { requests, state } = openUsers({ enabled: true });

    const region = await section();
    fireEvent.click(
      await within(region).findByRole("button", { name: "Desactivá la verificación" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "¿Desactivás la verificación en dos pasos?",
    });
    expect(dialog).toHaveTextContent("Tu cuenta queda menos protegida");

    fireEvent.change(within(dialog).getByLabelText("Tu contraseña"), {
      target: { value: DEMO_PASSWORD },
    });
    fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
      target: { value: "999999" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá la verificación" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El código o la contraseña no son correctos.",
    );
    expect(within(dialog).getByLabelText("Tu contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(state.enabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Tu contraseña"), {
      target: { value: DEMO_PASSWORD },
    });
    fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
      target: { value: DEMO_TOTP_CODE },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá la verificación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(await within(region).findByText("Desactivada")).toBeInTheDocument();
    expect(region).toHaveTextContent("Listo: desactivaste la verificación en dos pasos.");
    const disable = requests.filter((request) => request.path === "/api/v1/me/two-factor/disable");
    expect(disable.map((request) => request.body)).toEqual([
      { password: DEMO_PASSWORD, code: "999999" },
      { password: DEMO_PASSWORD, code: DEMO_TOTP_CODE },
    ]);
  });

  it("refreshes and explains when it was already turned on elsewhere (409)", async () => {
    const { state } = openUsers();
    await section();
    state.enabled = true;
    const dialog = await startEnrollment();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "ya está activada en tu cuenta",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(await within(await section()).findByText("Activada")).toBeInTheDocument();
  });

  it("does not close while the confirmation is in flight, so the codes always reach the screen", async () => {
    const { release } = openUsers({}, "/api/v1/me/two-factor/enrollment/confirm");
    const dialog = await reachCodeStep();
    await confirmCode(DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("button", { name: "Activando…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Volvé al código QR" })).toBeDisabled();

    tryToClose(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    release();
    const codes = await screen.findByRole("dialog", { name: "Guardá tus códigos de recuperación" });
    expect(codes).toHaveTextContent(demoRecoveryCodes(1)[0]!);
    // From here the codes panel guards the dialog, not the finished request.
    tryToClose(codes);
    expect(await within(codes).findByRole("alert")).toHaveTextContent(/Antes de cerrar/);
  });

  it("does not close while new codes are being generated", async () => {
    const { release } = openUsers({ enabled: true }, "/api/v1/me/two-factor/recovery-codes");
    const dialog = await openEnabledAction("Generá códigos nuevos", "¿Generás códigos nuevos?");
    fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
      target: { value: DEMO_TOTP_CODE },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generá los códigos nuevos" }));
    expect(await within(dialog).findByRole("button", { name: "Generando…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelá" })).toBeDisabled();

    tryToClose(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    release();
    expect(
      await screen.findByRole("dialog", { name: "Guardá tus códigos nuevos" }),
    ).toHaveTextContent(demoRecoveryCodes(1)[0]!);
  });

  it("does not close while turning it off, and closes when it is done", async () => {
    const { release } = openUsers({ enabled: true }, "/api/v1/me/two-factor/disable");
    const dialog = await openEnabledAction(
      "Desactivá la verificación",
      "¿Desactivás la verificación en dos pasos?",
    );
    fillDisable(dialog, DEMO_PASSWORD, DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("button", { name: "Desactivando…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelá" })).toBeDisabled();

    tryToClose(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await within(await section()).findByText("Desactivada")).toBeInTheDocument();
  });

  it("goes back from the code to the QR step", async () => {
    openUsers();
    const dialog = await reachCodeStep();
    fireEvent.click(within(dialog).getByRole("button", { name: "Volvé al código QR" }));
    const scan = await screen.findByRole("dialog", { name: "Agregá tu cuenta a la app" });
    expect(within(scan).getByRole("heading", { name: "Agregá tu cuenta a la app" })).toHaveFocus();
    expect(within(scan).getByRole("img", { name: /Código QR/ })).toBeInTheDocument();
  });

  it("starts over when the enrollment is no longer in progress (409 on confirm)", async () => {
    const { state } = openUsers();
    const dialog = await reachCodeStep();
    // Another tab started again or finished: the server has no enrollment for this code.
    state.pending = false;
    await confirmCode(DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La activación ya no está en curso",
    );
    expect(within(dialog).queryByLabelText("Código de 6 números")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Volvé a empezar" }));
    expect(await screen.findByRole("dialog", { name: "Confirmá que sos vos" })).toBeInTheDocument();
  });

  it("explains and refreshes when it was turned off elsewhere (409 on regenerate)", async () => {
    const { state } = openUsers({ enabled: true });
    const dialog = await openEnabledAction("Generá códigos nuevos", "¿Generás códigos nuevos?");
    state.enabled = false;
    fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
      target: { value: DEMO_TOTP_CODE },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generá los códigos nuevos" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "ya no está activada en tu cuenta",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Generá los códigos nuevos" }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await within(await section()).findByText("Desactivada")).toBeInTheDocument();
  });

  it("explains and refreshes when it was already off (409 on disable)", async () => {
    const { state } = openUsers({ enabled: true });
    const dialog = await openEnabledAction(
      "Desactivá la verificación",
      "¿Desactivás la verificación en dos pasos?",
    );
    state.enabled = false;
    fillDisable(dialog, DEMO_PASSWORD, DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("ya estaba desactivada");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await within(await section()).findByText("Desactivada")).toBeInTheDocument();
  });

  it("rejects a wrong code when generating new codes (422)", async () => {
    const { state } = openUsers({ enabled: true });
    const dialog = await openEnabledAction("Generá códigos nuevos", "¿Generás códigos nuevos?");
    fireEvent.change(within(dialog).getByLabelText("Código de 6 números"), {
      target: { value: "111111" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Generá los códigos nuevos" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(
      "El código no es correcto. Escribí el que muestra ahora tu app o un código de recuperación sin usar.",
    );
    const input = within(dialog).getByLabelText("Código de 6 números");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(state.codes).toEqual(demoRecoveryCodes(0));
  });

  it("says how long to wait on the code step (429)", async () => {
    const { state } = openUsers();
    const dialog = await reachCodeStep();
    state.throttled = true;
    await confirmCode(DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Esperá 2 minutos y probá de nuevo.",
    );
  });

  it("says how long to wait when turning it off too many times (429)", async () => {
    openUsers({ enabled: true, throttled: true });
    const dialog = await openEnabledAction(
      "Desactivá la verificación",
      "¿Desactivás la verificación en dos pasos?",
    );
    fillDisable(dialog, DEMO_PASSWORD, DEMO_TOTP_CODE);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Esperá 2 minutos y probá de nuevo.",
    );
  });

  it("turns it off with a recovery code, switching between the app code and a recovery code", async () => {
    const { requests } = openUsers({ enabled: true });
    const dialog = await openEnabledAction(
      "Desactivá la verificación",
      "¿Desactivás la verificación en dos pasos?",
    );
    const app = within(dialog).getByLabelText("Código de 6 números");
    expect(app).toHaveAttribute("inputmode", "numeric");

    fireEvent.click(within(dialog).getByRole("button", { name: "Usá un código de recuperación" }));
    const recovery = within(dialog).getByLabelText("Código de recuperación");
    expect(recovery).toHaveAttribute("inputmode", "text");
    fireEvent.click(within(dialog).getByRole("button", { name: "Usá el código de la app" }));
    expect(within(dialog).getByLabelText("Código de 6 números")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Usá un código de recuperación" }));

    // A recovery code is not 6 numbers: the app schema would reject it, this one accepts it.
    fillDisable(dialog, DEMO_PASSWORD, demoRecoveryCodes(0)[3]!.toLowerCase());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const disable = requests.find((request) => request.path === "/api/v1/me/two-factor/disable");
    expect(disable?.body).toEqual({ password: DEMO_PASSWORD, code: demoRecoveryCodes(0)[3] });
  });

  it("selects the key and the codes to copy by hand when the clipboard fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
      configurable: true,
    });
    openUsers();
    await startEnrollment();
    const scan = await screen.findByRole("dialog", { name: "Agregá tu cuenta a la app" });
    fireEvent.click(within(scan).getByRole("button", { name: "Copiá la clave" }));
    expect(await within(scan).findByRole("alert")).toHaveTextContent(
      "No pudimos copiarla sola. La clave quedó seleccionada",
    );
    expect(window.getSelection()?.toString()).toContain("GEZD");

    fireEvent.click(within(scan).getByRole("button", { name: "Ya la agregué, continuá" }));
    await confirmCode(DEMO_TOTP_CODE);
    const codes = await screen.findByRole("dialog", { name: "Guardá tus códigos de recuperación" });
    fireEvent.click(within(codes).getByRole("button", { name: "Copiá los códigos" }));
    expect(await within(codes).findByRole("alert")).toHaveTextContent(
      "No pudimos copiarlos solos. La lista quedó seleccionada",
    );
    expect(window.getSelection()?.toString()).toContain(demoRecoveryCodes(1)[0]);
  });

  it("shows an error with a retry when the status does not load", async () => {
    signedIn(DEMO_ME, {
      ...settingsRoutes().routes,
      "GET /api/v1/me/two-factor": () => new Response(null, { status: 500 }),
    });
    renderApp("/ajustes/usuarios");
    const region = await section();
    // A server error is retried once before the screen gives up.
    expect(await within(region).findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "No pudimos ver si la tenés activada",
    );
    expect(within(region).getByRole("button", { name: "Volvé a intentar" })).toBeInTheDocument();
  });
});

describe("the Ajustes prompt", () => {
  it("invites an owner without two-factor, and links to the section", async () => {
    signedIn({ ...DEMO_ME, role: "OWNER", twoFactorEnabled: false }, settingsRoutes().routes);
    renderApp("/ajustes");

    const prompt = await screen.findByRole("region", {
      name: "Sumá la verificación en dos pasos a tu cuenta",
    });
    expect(within(prompt).getByRole("link", { name: "Activala ahora" })).toHaveAttribute(
      "href",
      "/ajustes/usuarios#verificacion-en-dos-pasos",
    );

    fireEvent.click(within(prompt).getByRole("button", { name: "Ahora no" }));
    expect(
      screen.queryByRole("region", { name: "Sumá la verificación en dos pasos a tu cuenta" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["an owner who has it on", { role: "OWNER" as const, twoFactorEnabled: true }],
    ["a lawyer without it", { role: "LAWYER" as const, twoFactorEnabled: false }],
    ["a paralegal without it", { role: "PARALEGAL" as const, twoFactorEnabled: false }],
  ])("stays out of the way for %s", async (_who, me) => {
    signedIn({ ...DEMO_ME, ...me }, settingsRoutes().routes);
    renderApp("/ajustes");
    expect(await screen.findByRole("heading", { level: 1, name: "Ajustes" })).toBeInTheDocument();
    expect(
      screen.queryByText("Sumá la verificación en dos pasos a tu cuenta"),
    ).not.toBeInTheDocument();
  });
});
