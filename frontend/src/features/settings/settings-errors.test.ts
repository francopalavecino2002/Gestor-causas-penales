import { describe, expect, it } from "vitest";

import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { ApiError, NETWORK_ERROR } from "@/lib/api";

const apiError = (status: number, type: string, detail?: string) =>
  new ApiError({ status, type, detail });

describe("settingsErrorMessage", () => {
  it("explains a missing permission", () => {
    expect(settingsErrorMessage(apiError(403, "access-denied"))).toBe(
      "Solo la persona titular del estudio puede hacer este cambio.",
    );
  });

  it("explains a network failure", () => {
    expect(settingsErrorMessage(apiError(0, NETWORK_ERROR))).toMatch(/Revisá tu conexión/);
  });

  it("translates the known custom-field details and falls back for the rest", () => {
    expect(
      settingsErrorMessage(
        apiError(400, "invalid-custom-field", "An option cannot be removed: hide it instead"),
      ),
    ).toBe("Una opción no se puede borrar: ocultala.");
    expect(
      settingsErrorMessage(
        apiError(400, "invalid-custom-field", "A list field needs at least one visible option"),
      ),
    ).toBe("Una lista necesita al menos una opción visible.");
    expect(settingsErrorMessage(apiError(400, "invalid-custom-field", "Something new"))).toBe(
      "Revisá los datos del campo y volvé a intentar.",
    );
  });

  it("asks to reload after a concurrent change or a missing item", () => {
    expect(settingsErrorMessage(apiError(409, "catalog-concurrent-change"))).toMatch(
      /Recargá la página/,
    );
    expect(settingsErrorMessage(apiError(404, "custom-field-not-found"))).toMatch(
      /Recargá la página/,
    );
  });

  it("never shows the server's text for unknown problems", () => {
    expect(settingsErrorMessage(apiError(500, "internal", "NullPointerException"))).toBe(
      "El servidor no respondió como esperábamos. Volvé a intentar en unos minutos.",
    );
    expect(settingsErrorMessage(apiError(400, "about:blank"))).toBe(
      "Revisá los datos y volvé a intentar.",
    );
    expect(settingsErrorMessage(new Error("boom"))).toMatch(/No pudimos guardar el cambio/);
  });
});
