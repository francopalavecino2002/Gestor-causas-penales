import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/render-app";

describe("DesignSystemPage", () => {
  it("presents the style guide with its sections in Spanish", async () => {
    renderApp("/design-system");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sistema de diseño" }),
    ).toBeInTheDocument();
    for (const name of [
      "Color",
      "Tipografía",
      "Forma, espacio y elevación",
      "Botones",
      "Formularios",
      "Estados y etiquetas",
      "Alertas",
      "Tarjetas y riel del día",
      "Pestañas y diálogo",
      "Carga y vacío",
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
  });

  it("offers the three theme choices", async () => {
    renderApp("/design-system");

    const themes = await screen.findByRole("group", { name: "Tema" });
    for (const name of ["Claro", "Oscuro", "Según el sistema"]) {
      expect(within(themes).getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("labels every form control and icon-only button", async () => {
    renderApp("/design-system");

    expect(await screen.findByRole("textbox", { name: "Número de legajo" })).toHaveValue(
      "DEMO-0098/2026",
    );
    expect(screen.getByLabelText("Horario")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Tipo de audiencia" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Avisarme un día antes" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Mostrar las audiencias que ya pasaron" }),
    ).toBeChecked();
    for (const name of ["Día anterior", "Día siguiente", "Buscar"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("shows hearing statuses as words and the assisted-calculation disclaimer", async () => {
    renderApp("/design-system");

    const statuses = await screen.findByRole("region", { name: "Estados y etiquetas" });
    for (const word of ["Solicitada", "Programada", "Reprogramada", "Efectiva", "Suspendida"]) {
      expect(within(statuses).getByText(word)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Cálculo asistido: verificá con la norma.").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("opens the archive confirmation dialog with a labeled close button", async () => {
    renderApp("/design-system");

    fireEvent.click(await screen.findByRole("button", { name: "Archivá el caso" }));

    const dialog = await screen.findByRole("dialog", {
      name: "¿Archivás el caso DEMO-0098/2026?",
    });
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
