import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_ME, problem, signedIn, type RecordedRequest } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import { RULE_INVESTIGATION, RULE_MEDIATION, RULE_REVIEW } from "@/test/settings-fixtures";
import { settingsRoutes } from "@/test/settings-mock";

const writes = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.method !== "GET");

const card = (name: string) => screen.getByRole("article", { name });

describe("settings: deadline rules", () => {
  it("shows every rule with its source, review tags and the disclaimer, detainees first", async () => {
    signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/plazos");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Reglas de plazos" }),
    ).toBeInTheDocument();
    await screen.findAllByRole("article");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Personas detenidas",
      "Otros plazos",
    ]);

    const review = card(RULE_REVIEW.name);
    expect(review).toHaveTextContent("Art. 118 · CPP de Neuquén (Ley 2784)");
    expect(within(review).getByText("[validar]")).toBeInTheDocument();
    expect(within(review).getByText("Persona detenida")).toBeInTheDocument();
    expect(review).toHaveTextContent("Plazo legal: 5 días corridos");
    expect(review).toHaveTextContent("Corre desde: Pedido de la defensa");
    const investigation = card(RULE_INVESTIGATION.name);
    expect(within(investigation).getByText("[no verificado]")).toBeInTheDocument();
    expect(investigation).toHaveTextContent(
      "Prórrogas posibles: Juez de garantías: hasta 4 mesesColegio de Jueces: hasta 4 meses",
    );
    expect(investigation).toHaveTextContent(
      "Se suspende por: Rebeldía (CPP art. 52), Mediación penal (Ley 2996) [validar]",
    );
    expect(investigation).toHaveTextContent("el plazo sigue vigente. (revisada el 21/11/2026)");
    const note = within(investigation).getByRole("link", { name: /Leé la nota/ });
    expect(note).toHaveAttribute("href", RULE_INVESTIGATION.caseLaw?.url);
    expect(note).toHaveAttribute("target", "_blank");
    expect(note).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(review).queryByRole("link")).not.toBeInTheDocument();
    expect(card(RULE_MEDIATION.name)).toHaveTextContent("Desactivada en el estudio");

    for (const article of screen.getAllByRole("article")) {
      expect(article).toHaveTextContent("Cálculo asistido: verificá con la norma.");
    }
    // Also once on top of the page, outside the cards.
    expect(screen.getAllByText(/Cálculo asistido: verificá con la norma\./)).toHaveLength(5);
  });

  it("asks before disabling a detainee's rule and re-enables without asking", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/plazos");

    const review = await screen.findByRole("article", { name: RULE_REVIEW.name });
    fireEvent.click(within(review).getByRole("switch", { name: "Activa en el estudio" }));

    const dialog = await screen.findByRole("dialog", {
      name: `¿Desactivás ${RULE_REVIEW.name}?`,
    });
    expect(dialog).toHaveTextContent("protege a una persona privada de su libertad");
    expect(writes(requests)).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá la regla" }));

    await waitFor(() =>
      expect(within(card(RULE_REVIEW.name)).getByRole("status")).toHaveTextContent(
        "Guardado: la regla está desactivada.",
      ),
    );
    expect(writes(requests)[0]?.body).toEqual({ enabled: false, alertDaysBefore: 2 });
    expect(writes(requests)[0]?.path).toBe(
      `/api/v1/deadline-rules/${RULE_REVIEW.code}/settings`,
    );
    expect(card(RULE_REVIEW.name)).toHaveTextContent("Desactivada en el estudio");

    const mediation = card(RULE_MEDIATION.name);
    fireEvent.click(within(mediation).getByRole("switch", { name: "Activa en el estudio" }));
    await waitFor(() =>
      expect(within(card(RULE_MEDIATION.name)).getByRole("status")).toHaveTextContent(
        "Guardado: la regla está activa.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes(requests)[1]?.body).toEqual({ enabled: true, alertDaysBefore: 5 });
  });

  it("validates and saves the warning days", async () => {
    const requests = signedIn(undefined, settingsRoutes().routes);
    renderApp("/ajustes/plazos");

    const investigation = await screen.findByRole("article", { name: RULE_INVESTIGATION.name });
    const days = within(investigation).getByLabelText("Días de aviso antes del vencimiento");
    expect(days).toHaveValue(15);
    expect(investigation).toHaveTextContent("Sugerido por la norma: 15 días antes.");

    fireEvent.change(days, { target: { value: "120" } });
    fireEvent.click(within(investigation).getByRole("button", { name: "Guardá el aviso" }));
    expect(
      await within(investigation).findByText("El aviso puede ser de hasta 90 días antes."),
    ).toBeInTheDocument();
    fireEvent.change(days, { target: { value: "" } });
    fireEvent.click(within(investigation).getByRole("button", { name: "Guardá el aviso" }));
    expect(
      await within(investigation).findByText("Escribí cuántos días antes querés el aviso."),
    ).toBeInTheDocument();
    expect(writes(requests)).toHaveLength(0);

    fireEvent.change(days, { target: { value: "30" } });
    fireEvent.click(within(investigation).getByRole("button", { name: "Guardá el aviso" }));
    await waitFor(() =>
      expect(within(card(RULE_INVESTIGATION.name)).getByRole("status")).toHaveTextContent(
        "Guardado: te avisamos 30 días antes.",
      ),
    );
    expect(writes(requests)[0]?.body).toEqual({ enabled: true, alertDaysBefore: 30 });
  });

  it("explains in Spanish why a switch change failed and keeps the rule as it was", async () => {
    const { routes } = settingsRoutes();
    signedIn(undefined, {
      ...routes,
      [`PUT /api/v1/deadline-rules/${RULE_MEDIATION.code}/settings`]: () =>
        problem(500, "internal"),
      [`PUT /api/v1/deadline-rules/${RULE_REVIEW.code}/settings`]: () =>
        problem(403, "access-denied"),
    });
    renderApp("/ajustes/plazos");

    const mediation = await screen.findByRole("article", { name: RULE_MEDIATION.name });
    fireEvent.click(within(mediation).getByRole("switch", { name: "Activa en el estudio" }));
    const serverAlert = await within(mediation).findByRole("alert", undefined, { timeout: 4000 });
    expect(serverAlert).toHaveTextContent(
      "El servidor no respondió como esperábamos. Volvé a intentar en unos minutos.",
    );
    expect(within(mediation).getByRole("switch", { name: "Activa en el estudio" })).not.toBeChecked();
    expect(mediation).toHaveTextContent("Desactivada en el estudio");

    const review = card(RULE_REVIEW.name);
    fireEvent.click(within(review).getByRole("switch", { name: "Activa en el estudio" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Desactivá la regla" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Solo la persona titular del estudio puede hacer este cambio.",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelá" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(review).getByRole("switch", { name: "Activa en el estudio" })).toBeChecked();
  });

  it("shows the settings as text to a member who is not the owner", async () => {
    signedIn({ ...DEMO_ME, role: "ADMIN_STAFF" }, settingsRoutes().routes);
    renderApp("/ajustes/plazos");

    const review = await screen.findByRole("article", { name: RULE_REVIEW.name });
    expect(review).toHaveTextContent("Aviso: 2 días antes");
    expect(card(RULE_MEDIATION.name)).toHaveTextContent("Aviso: Sin aviso: regla desactivada");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
