import { describe, expect, it } from "vitest";

import {
  agendaSummary,
  cppArticle,
  detaineeAlertSentence,
  joinNames,
  lawyerOptions,
} from "@/features/agenda/agenda-format";
import { parseAgendaSearch } from "@/features/agenda/agenda-search";
import type { DetaineeAlert } from "@/features/agenda/agenda-types";

const alert = (overrides: Partial<DetaineeAlert>): DetaineeAlert => ({
  kind: "ENDS",
  dueOn: "2026-11-27",
  daysLeft: 4,
  article: "116",
  caseId: "c",
  caseCaption: "Modelo, Carla s/ homicidio",
  defendantId: "d",
  defendantName: "Carla Modelo",
  measureId: "m",
  disclaimer: "Cálculo asistido: verificá con la norma.",
  ...overrides,
});

describe("agenda texts", () => {
  it("writes the CPP article in singular or plural", () => {
    expect(cppArticle("118")).toBe("CPP art. 118");
    expect(cppArticle("36 inc. 1")).toBe("CPP art. 36 inc. 1");
    expect(cppArticle("167 a 169")).toBe("CPP arts. 167 a 169");
    expect(cppArticle("112, 113 y 116")).toBe("CPP arts. 112, 113 y 116");
    expect(cppArticle("197 y 198")).toBe("CPP arts. 197 y 198");
    expect(cppArticle(null)).toBeNull();
    expect(cppArticle("  ")).toBeNull();
  });

  it("joins names the Spanish way", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames([{ id: "1", name: "Ana" }])).toBe("Ana");
    expect(
      joinNames([
        { id: "1", name: "Ana" },
        { id: "2", name: "Beto" },
        { id: "3", name: "Ceci" },
      ]),
    ).toBe("Ana, Beto y Ceci");
  });

  it("summarizes the agenda in second person, or third for a colleague", () => {
    expect(agendaSummary({ count: 5, detained: 1, scope: "hoy" })).toBe(
      "Hoy tenés 5 audiencias, 1 con una persona detenida.",
    );
    expect(agendaSummary({ count: 1, detained: 0, scope: "esta semana" })).toBe(
      "Esta semana tenés 1 audiencia.",
    );
    expect(agendaSummary({ count: 2, detained: 2, scope: "hoy", lawyerName: "Paula Demo" })).toBe(
      "Paula Demo tiene 2 audiencias hoy, 2 con personas detenidas.",
    );
  });

  it("offers the whole firm, the user and every lawyer seen, by name", () => {
    const options = lawyerOptions(
      "me",
      [
        { id: "p", name: "Paula Demo" },
        { id: "me", name: "Lucía Ejemplo" },
        { id: "h", name: "Hugo Prueba" },
        { id: "p", name: "Paula Demo" },
      ],
      undefined,
    );
    expect(options).toEqual([
      { value: "", label: "Todo el estudio" },
      { value: "me", label: "Mis audiencias" },
      { value: "h", label: "Hugo Prueba" },
      { value: "p", label: "Paula Demo" },
    ]);
    expect(lawyerOptions("me", [], "x").at(-1)).toEqual({
      value: "x",
      label: "Otro abogado o abogada",
    });
  });

  it("leaves out 'Mis audiencias' until the user is known", () => {
    expect(lawyerOptions(undefined, [{ id: "p", name: "Paula Demo" }], undefined)).toEqual([
      { value: "", label: "Todo el estudio" },
      { value: "p", label: "Paula Demo" },
    ]);
  });

  it("reads well for a colleague we have not seen yet", () => {
    expect(agendaSummary({ count: 1, detained: 0, scope: "hoy", lawyerName: "Esa persona" })).toBe(
      "Esa persona tiene 1 audiencia hoy.",
    );
  });

  it("words each detainee alert with its date, overdue or not", () => {
    expect(detaineeAlertSentence(alert({}))).toBe(
      "La medida de coerción vence el viernes 27/11 (en 4 días).",
    );
    expect(detaineeAlertSentence(alert({ daysLeft: 0 }))).toBe("La medida de coerción vence hoy.");
    expect(detaineeAlertSentence(alert({ kind: "REVIEW", daysLeft: 1 }))).toBe(
      "La revisión de la medida es mañana.",
    );
    expect(
      detaineeAlertSentence(alert({ kind: "REVIEW", dueOn: "2026-11-20", daysLeft: -3 })),
    ).toBe("La revisión de la medida venció el viernes 20/11 (hace 3 días).");
    expect(detaineeAlertSentence(alert({ kind: "MAX_DURATION", daysLeft: -1 }))).toBe(
      "Cumplió un año en prisión preventiva ayer.",
    );
    expect(detaineeAlertSentence(alert({ kind: "NO_DURATION", dueOn: null, daysLeft: null }))).toBe(
      "La prisión preventiva no tiene fecha de fin cargada. Cargala en el caso.",
    );
  });
});

describe("agenda search params", () => {
  it("keeps valid values and drops the rest", () => {
    expect(
      parseAgendaSearch({
        vista: "semana",
        fecha: "2026-11-23",
        abogado: "00000000-0000-4000-8000-000000000002",
      }),
    ).toEqual({
      vista: "semana",
      fecha: "2026-11-23",
      abogado: "00000000-0000-4000-8000-000000000002",
    });
    expect(parseAgendaSearch({ vista: "mes", fecha: "2026-13-01", abogado: "x" })).toEqual({
      vista: undefined,
      fecha: undefined,
      abogado: undefined,
    });
  });
});
