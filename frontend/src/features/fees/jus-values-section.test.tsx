import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, feeRoutes, signedIn, type RecordedRequest } from "@/test/mock-api";
import { JUS_MARCH, JUS_TYPO } from "@/test/fee-fixtures";
import { renderApp } from "@/test/render-app";

const TODAY = "2026-11-25";

/** Accessible names keep the no-break space between "$" and the number. */
const nb = (text: string) => text.replace(/\$ /g, "$\u00a0");

const writes = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method !== "GET")
    .map((request) => ({ path: request.path, body: request.body }));

async function openSection() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Valor del JUS" }),
  ).toBeInTheDocument();
  return screen.findByRole("region", { name: "Vigente hoy" });
}

describe("settings: the JUS value", () => {
  it("shows today's value, the history and the official source, opened apart", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/ajustes/jus");

    const current = await openSection();
    expect(current).toHaveTextContent("$ 94.963,25");
    expect(current).toHaveTextContent("Desde el 01/07/2026");
    const source = within(current).getByRole("link", { name: /sitio del Poder Judicial/ });
    expect(source).toHaveAttribute("href", "https://www.jusneuquen.gov.ar/valor-jus/");
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(current).toHaveTextContent("El sistema nunca lo busca solo");

    const history = screen.getByRole("region", { name: "Historial" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(within(history).getByText("Vigente hoy")).toBeInTheDocument();
    // Archived values only when asked.
    expect(within(history).queryByText("$ 8.125,00")).toBeNull();
    fireEvent.click(within(history).getByRole("switch", { name: "Mostrá los archivados" }));
    expect(await within(history).findByText("$ 8.125,00")).toBeInTheDocument();
    expect(within(history).getByText("Archivado")).toBeInTheDocument();
  });

  it("lets other roles read, but not load or archive", async () => {
    const requests = signedIn(
      { ...DEMO_ME, role: "PARALEGAL" },
      feeRoutes(undefined, { today: TODAY }),
    );
    renderApp("/ajustes/jus");

    await openSection();
    expect(
      screen.getByText(/Lo cargan y lo archivan la persona titular y los abogados/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Solo la persona titular del estudio puede cambiarla/)).toBeNull();
    expect(screen.queryByLabelText("Valor del JUS")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Archivá/ })).toBeNull();
    expect(writes(requests)).toEqual([]);
  });

  it("lets a lawyer load a new value with the day it applies from", async () => {
    const requests = signedIn(
      { ...DEMO_ME, role: "LAWYER" },
      feeRoutes(undefined, { today: TODAY }),
    );
    renderApp("/ajustes/jus");
    await openSection();

    const value = screen.getByLabelText("Valor del JUS");
    fireEvent.change(value, { target: { value: "100000" } });
    fireEvent.blur(value);
    await waitFor(() => expect(value).toHaveValue("100.000,00"));
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardá el valor" }));

    expect(
      await screen.findByText("Guardado: el JUS de $ 100.000,00, vigente desde el 01/12/2026."),
    ).toBeInTheDocument();
    expect(writes(requests)).toEqual([
      { path: "/api/v1/fees/jus-values", body: { value: 100_000, validFrom: "2026-12-01" } },
    ]);
    const history = screen.getByRole("region", { name: "Historial" });
    expect(
      await within(history).findByRole("listitem", {
        name: nb("JUS de $ 100.000,00 desde el 01/12/2026"),
      }),
    ).toBeInTheDocument();
    expect(value).toHaveValue("");
  });

  it("checks the value and marks the day already taken", async () => {
    const requests = signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/ajustes/jus");
    await openSection();

    fireEvent.click(screen.getByRole("button", { name: "Guardá el valor" }));
    expect(await screen.findByText("Escribí el valor del JUS en pesos.")).toBeInTheDocument();
    expect(writes(requests)).toEqual([]);

    fireEvent.change(screen.getByLabelText("Valor del JUS"), { target: { value: "95.000" } });
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-07-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardá el valor" }));

    expect(await screen.findByText(/Ya hay un valor vigente desde ese día/)).toBeInTheDocument();
    expect(screen.getByLabelText("Vigente desde")).toHaveAttribute("aria-invalid", "true");
  });

  it("archives a value in place with Deshacé, and undoes it", async () => {
    const requests = signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/ajustes/jus");
    await openSection();

    fireEvent.click(
      screen.getByRole("button", {
        name: nb("Archivá el valor de $ 81.250,00 desde el 01/03/2026"),
      }),
    );

    const undo = await screen.findByRole("button", { name: "Deshacé" });
    expect(
      screen.getByText("Archivaste el valor de $ 81.250,00 desde el 01/03/2026."),
    ).toBeVisible();
    await waitFor(() => expect(undo).toHaveFocus());

    fireEvent.click(undo);
    const archive = await screen.findByRole("button", {
      name: nb("Archivá el valor de $ 81.250,00 desde el 01/03/2026"),
    });
    await waitFor(() => expect(archive).toHaveFocus());
    expect(writes(requests).map((write) => write.path)).toEqual([
      `/api/v1/fees/jus-values/${JUS_MARCH.id}/archive`,
      `/api/v1/fees/jus-values/${JUS_MARCH.id}/restore`,
    ]);
  });

  it("says why an archived value cannot come back while another one has its day", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/ajustes/jus");
    await openSection();

    fireEvent.click(screen.getByRole("switch", { name: "Mostrá los archivados" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: nb("Restaurá el valor de $ 8.125,00 desde el 01/03/2026"),
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ya hay otro valor vigente desde ese mismo día",
    );
    expect(JUS_TYPO.archived).toBe(true);
  });
});
