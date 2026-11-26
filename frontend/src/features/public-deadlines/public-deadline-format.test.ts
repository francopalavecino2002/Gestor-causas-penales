import { describe, expect, it } from "vitest";

import {
  articleOf,
  calculationErrorMessage,
  dueParts,
  dueSentence,
  startLabel,
  THROTTLED_MESSAGE,
} from "@/features/public-deadlines/public-deadline-format";
import type { PublicCalculation } from "@/features/public-deadlines/public-deadline-types";
import { ApiError } from "@/lib/api";
import { PUBLIC_CONTROL, PUBLIC_REVIEW } from "@/test/public-deadline-fixtures";

const base: PublicCalculation = {
  rule: PUBLIC_REVIEW,
  startDate: "2026-11-20",
  startTime: null,
  outcome: "DUE",
  dueOn: "2026-11-25",
  dueAt: "2026-11-26T03:00:00Z",
  missingYear: null,
  calendarSource: null,
  calendarFlags: [],
  disclaimer: "Cálculo asistido: verificá con la norma.",
};

describe("public deadline format", () => {
  it("keeps only the article of the source", () => {
    expect(articleOf("Art. 112; 49 inc. 5 · CPP de Neuquén (Ley 2784)")).toBe(
      "Art. 112; 49 inc. 5",
    );
    expect(articleOf("Art. 242")).toBe("Art. 242");
  });

  it("ends a day-based term at 24 h of its last day", () => {
    expect(dueParts(base)).toEqual({
      day: "Miércoles 25 de noviembre de 2026",
      numericDay: "25/11/2026",
      time: "a las 24 h",
    });
    expect(dueSentence(base)).toBe("Vence el miércoles 25 de noviembre de 2026 a las 24 h.");
  });

  it("ends a term in hours at its instant, on Neuquén's wall clock", () => {
    const hours: PublicCalculation = {
      ...base,
      rule: PUBLIC_CONTROL,
      startTime: "23:15:00",
      dueOn: "2026-11-21",
      // 23:15 of the 21st in Neuquén is 02:15 UTC of the 22nd.
      dueAt: "2026-11-22T02:15:00Z",
    };
    expect(dueParts(hours)).toEqual({
      day: "Sábado 21 de noviembre de 2026",
      numericDay: "21/11/2026",
      time: "a las 23:15",
    });
    expect(startLabel(hours)).toBe("20/11/2026, 23:15");
  });

  it("has no due date when the court calendar is missing", () => {
    const missing: PublicCalculation = {
      ...base,
      outcome: "CALENDAR_NOT_LOADED",
      dueOn: null,
      dueAt: null,
      missingYear: 2028,
    };
    expect(dueParts(missing)).toBeNull();
    expect(dueSentence(missing)).toBe(
      "No se puede calcular: el calendario judicial de 2028 todavía no está cargado",
    );
  });

  it("explains the rate limit, with the wait when the server sends it", () => {
    const throttled = new ApiError({ status: 429, type: "public-calculator-throttled" });
    expect(calculationErrorMessage(throttled)).toBe(THROTTLED_MESSAGE);
    expect(
      calculationErrorMessage(
        new ApiError({ status: 429, type: "public-calculator-throttled", retryAfter: 1 }),
      ),
    ).toBe(`${THROTTLED_MESSAGE} Podés volver a calcular en 1 segundo.`);
  });
});
