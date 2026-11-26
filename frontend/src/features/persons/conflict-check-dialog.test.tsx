import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { personRoutes, problem, signedIn } from "@/test/mock-api";
import { CONFLICT_DISCLAIMER, PERSON_COMPANY } from "@/test/person-fixtures";
import { renderApp } from "@/test/render-app";

async function openCheck() {
  renderApp("/personas");
  fireEvent.click(await screen.findByRole("button", { name: "Control de conflicto" }));
  return screen.findByRole("dialog", { name: "Control de conflicto" });
}

function search(dialog: HTMLElement, number: string) {
  fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
    target: { value: number },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Buscá el documento" }));
}

describe("ConflictCheckDialog", () => {
  it("shows who has the document, with their roles and the disclaimer", async () => {
    const requests = signedIn(undefined, personRoutes());
    const dialog = await openCheck();

    search(dialog, "30-99000333-1");

    expect(
      await within(dialog).findByText("Ya hay 1 persona con este documento"),
    ).toBeInTheDocument();
    const company = within(dialog).getByRole("article", { name: PERSON_COMPANY.displayName });
    expect(company).toHaveTextContent("Querellante");
    expect(within(dialog).getByText(CONFLICT_DISCLAIMER)).toBeInTheDocument();
    expect(requests.find((r) => r.path === "/api/v1/persons/conflict-check")?.body).toEqual({
      documentNumber: "30990003331",
    });
  });

  it("says when nobody has it, still with the disclaimer", async () => {
    signedIn(undefined, personRoutes());
    const dialog = await openCheck();

    search(dialog, "99000999");

    expect(
      await within(dialog).findByText("No hay otras personas con este documento"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(CONFLICT_DISCLAIMER)).toBeInTheDocument();
  });

  it("explains a failure", async () => {
    signedIn(undefined, {
      ...personRoutes(),
      "POST /api/v1/persons/conflict-check": () => problem(500, "internal"),
    });
    const dialog = await openCheck();

    search(dialog, "99000111");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "No pudimos hacer el control. Volvé a intentar en unos minutos.",
    );
  });

  it("clears the result as soon as the number is edited", async () => {
    signedIn(undefined, personRoutes());
    const dialog = await openCheck();
    search(dialog, "30990003331");
    await within(dialog).findByText("Ya hay 1 persona con este documento");

    fireEvent.change(within(dialog).getByLabelText("Número de documento"), {
      target: { value: "3099000333" },
    });

    await waitFor(() =>
      expect(within(dialog).queryByText("Ya hay 1 persona con este documento")).toBeNull(),
    );
    expect(within(dialog).queryByText(CONFLICT_DISCLAIMER)).toBeNull();
  });
});
