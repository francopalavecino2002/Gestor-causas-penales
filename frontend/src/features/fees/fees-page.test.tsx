import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, feeRoutes, signedIn, type RecordedRequest } from "@/test/mock-api";
import { MIN_DEFENSA_PLENARIO, MIN_DIVORCIO, MIN_EXCARCELACION } from "@/test/fee-fixtures";
import { renderApp } from "@/test/render-app";

const TODAY = "2026-11-25";

const calculations = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path === "/api/v1/fees/calculations");

async function openCalculator() {
  await screen.findByRole("heading", { level: 1, name: "Honorarios" });
  const select = await screen.findByLabelText("Tipo de asunto");
  // The date is fixed so the JUS value that applies does not depend on the machine's clock.
  fireEvent.change(screen.getByLabelText("Fecha del valor del JUS"), { target: { value: TODAY } });
  return select;
}

describe("fees calculator", () => {
  it("asks for the kind of matter and a valid amount before calculating", async () => {
    const requests = signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    await openCalculator();

    fireEvent.click(screen.getByRole("button", { name: "Calculá el honorario" }));
    expect(await screen.findByText("Elegí el tipo de asunto.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de asunto")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByLabelText("Monto del proceso"), { target: { value: "1500.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculá el honorario" }));
    expect(
      await screen.findByText("Escribí el monto en pesos, por ejemplo 1.500.000,50."),
    ).toBeInTheDocument();
    expect(calculations(requests)).toEqual([]);
  });

  it("groups the kinds of matter by area, with their JUS, article and review tag", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    const select = await openCalculator();

    const penal = within(select).getByRole("group", { name: "Penal" });
    expect(
      within(penal).getByRole("option", {
        name: "Pedido de excarcelación: 10 JUS (art. 9, I) [validar]",
      }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("group", { name: "Para todos los fueros" }),
    ).toBeInTheDocument();
    // The firm only works in penal: family matters are not offered.
    expect(
      within(select).queryByRole("option", { name: new RegExp(MIN_DIVORCIO.name) }),
    ).toBeNull();

    fireEvent.change(select, { target: { value: MIN_DEFENSA_PLENARIO.code } });
    expect(screen.getByText("Mínimo de 40 JUS (Ley 1594, art. 9, I, 16) [validar]")).toBeVisible();
    expect(screen.getByText(/procedimiento escrito anterior/)).toBeVisible();
  });

  it("sends the amount, role, instance and day, and shows the steps with their articles", async () => {
    const requests = signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    const select = await openCalculator();

    fireEvent.change(select, { target: { value: MIN_EXCARCELACION.code } });
    const amount = screen.getByLabelText("Monto del proceso");
    fireEvent.change(amount, { target: { value: "20000000" } });
    fireEvent.blur(amount);
    await waitFor(() => expect(amount).toHaveValue("20.000.000,00"));
    fireEvent.click(screen.getByRole("switch", { name: "Tu cliente perdió todo" }));
    fireEvent.click(screen.getByRole("radio", { name: /Apoderado \(procurador\)/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^Segunda instancia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Calculá el honorario" }));

    const result = await screen.findByRole("region", { name: "Honorario estimado" });
    expect(calculations(requests).map((request) => request.body)).toEqual([
      {
        amount: 20_000_000,
        minimumCode: MIN_EXCARCELACION.code,
        clientLostEntirely: true,
        role: "ATTORNEY",
        instance: "APPEAL",
        date: TODAY,
      },
    ]);
    // 7,7% to 20% of 20.000.000 (above the 10 JUS minimum), × 40%, × 25% to 35%.
    expect(result).toHaveTextContent("$ 154.000,00 a $ 560.000,00");
    expect(result).toHaveTextContent("JUS de $ 94.963,25, vigente desde el 01/07/2026.");
    const steps = within(result).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent("Ley 1594, art. 7 [validar]");
    expect(steps[0]).toHaveTextContent("porque tu cliente perdió todo");
    expect(steps[2]).toHaveTextContent("Ley 1594, art. 10");
    expect(steps[3]).toHaveTextContent("Ley 1594, art. 15");
    expect(within(result).getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();
    expect(result).toHaveTextContent("El honorario lo regula el juez");
    await waitFor(() =>
      expect(within(result).getByRole("heading", { name: "Honorario estimado" })).toHaveFocus(),
    );
  });

  it("uses the minimum without an amount and shows it in pesos and in JUS", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    const select = await openCalculator();

    fireEvent.change(select, { target: { value: MIN_EXCARCELACION.code } });
    fireEvent.click(screen.getByRole("button", { name: "Calculá el honorario" }));

    const result = await screen.findByRole("region", { name: "Honorario estimado" });
    expect(result).toHaveTextContent("$ 949.632,50");
    expect(result).toHaveTextContent("10 JUS");
    expect(result).toHaveTextContent("Sin monto, el honorario es el mínimo");
  });

  it("keeps the disclaimer visible before calculating", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    await openCalculator();

    expect(screen.getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();
  });

  it("says no JUS value applies on the chosen day and links to load it", async () => {
    signedIn(undefined, feeRoutes(undefined, { today: TODAY }));
    renderApp("/honorarios");
    const select = await openCalculator();

    fireEvent.change(select, { target: { value: MIN_EXCARCELACION.code } });
    fireEvent.change(screen.getByLabelText("Fecha del valor del JUS"), {
      target: { value: "2026-01-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculá el honorario" }));

    const empty = await screen.findByRole("region", { name: "Cargá el valor del JUS" });
    expect(empty).toHaveTextContent("No hay un valor del JUS vigente al 10/01/2026");
    expect(within(empty).getByRole("link", { name: "Cargá el valor del JUS" })).toHaveAttribute(
      "href",
      "/ajustes/jus",
    );
  });

  it("explains a firm without JUS values, and who to ask when the user cannot load it", async () => {
    signedIn({ ...DEMO_ME, role: "PARALEGAL" }, feeRoutes([], { today: TODAY }));
    renderApp("/honorarios");
    await openCalculator();

    const empty = await screen.findByRole("region", { name: "Cargá el valor del JUS" });
    expect(empty).toHaveTextContent("El sistema no lo busca solo.");
    expect(empty).toHaveTextContent("Pedile a un titular o abogado que lo cargue.");
    expect(within(empty).queryByRole("link")).toBeNull();
  });
});
