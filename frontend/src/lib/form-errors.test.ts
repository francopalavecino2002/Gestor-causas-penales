import { describe, expect, it } from "vitest";

import { ApiError, NETWORK_ERROR } from "@/lib/api";
import { formProblem } from "@/lib/form-errors";

const FIELDS = ["caption", "mpfLegajo"] as const;
const RULES = [
  {
    type: "case-duplicate-legajo",
    field: "mpfLegajo" as const,
    message: "Ya hay otra causa con este legajo.",
  },
  { type: "invalid-case-data", detail: /responsible/i, message: "Elegí otra persona." },
];

const problem = (status: number, type: string, extra: Record<string, unknown> = {}) =>
  new ApiError({
    status,
    type,
    detail: typeof extra.detail === "string" ? extra.detail : undefined,
    problem: { type: `/problems/${type}`, status, ...extra },
  });

describe("formProblem", () => {
  it("puts a known problem on its field", () => {
    expect(
      formProblem(problem(409, "case-duplicate-legajo"), {
        subject: "la causa",
        rules: RULES,
        fields: FIELDS,
      }),
    ).toEqual({ fields: { mpfLegajo: "Ya hay otra causa con este legajo." } });
  });

  it("matches a rule by the backend's detail, and a rule without field is general", () => {
    const result = formProblem(
      problem(400, "invalid-case-data", { detail: "The responsible of a case must be a lawyer" }),
      { subject: "la causa", rules: RULES, fields: FIELDS },
    );
    expect(result).toEqual({ fields: {}, general: "Elegí otra persona." });
  });

  it("marks the fields a validation problem lists", () => {
    const result = formProblem(
      problem(400, "about:blank", { errors: [{ field: "caption" }, { pointer: "/unknown" }] }),
      { subject: "la causa", rules: RULES, fields: FIELDS },
    );
    expect(result).toEqual({ fields: { caption: "Revisá este dato." } });
  });

  it("says what happened and what to do for everything else", () => {
    const options = { subject: "la causa", rules: RULES, fields: FIELDS };
    expect(formProblem(new ApiError({ status: 0, type: NETWORK_ERROR }), options).general).toBe(
      "No hay conexión con el servidor, así que no se guardó la causa. Revisá tu conexión a internet y volvé a intentar.",
    );
    expect(formProblem(problem(400, "invalid-case-data"), options).general).toBe(
      "Revisá los datos marcados y volvé a intentar.",
    );
    expect(formProblem(new Error("boom"), options).general).toBe(
      "No pudimos guardar la causa. Volvé a intentar en unos minutos.",
    );
  });
});
