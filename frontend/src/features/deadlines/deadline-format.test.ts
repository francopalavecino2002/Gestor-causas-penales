import { describe, expect, it } from "vitest";

import {
  computationLabel,
  deadlinesSummary,
  dueLabel,
  dueLead,
  extensionDetail,
  extensionsLabel,
  groupDeadlines,
  isUrgent,
  notCalculableText,
  remainingLabel,
  triggeredLabel,
} from "@/features/deadlines/deadline-format";
import { parseDeadlineSearch, horizonSearch } from "@/features/deadlines/deadline-search";
import type { DeadlineView } from "@/features/deadlines/deadline-types";
import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import {
  ALL_DEADLINES,
  DEADLINE_APPEAL_MUESTRA,
  DEADLINE_CONTROL_LUCAS,
  DEADLINE_INVESTIGATION_DIEGO,
  DEADLINE_JUDICIAL_MODELO,
  DEADLINE_MEDIATION_MUESTRA,
  DEADLINE_REVIEW_CARLA,
} from "@/test/deadline-fixtures";

const with_ = (base: DeadlineView, overrides: Partial<DeadlineView>): DeadlineView => ({
  ...base,
  ...overrides,
});

describe("isUrgent and dueLead", () => {
  it("marks only overdue and due-soon deadlines as urgent", () => {
    expect(isUrgent("OVERDUE")).toBe(true);
    expect(isUrgent("DUE_SOON")).toBe(true);
    expect(isUrgent("RUNNING")).toBe(false);
    expect(isUrgent("MET")).toBe(false);
  });

  it("speaks in the past for what ended or was done", () => {
    expect(dueLead("OVERDUE")).toBe("Venció el ");
    expect(dueLead("MET")).toBe("Vencía el ");
    expect(dueLead("RUNNING")).toBe("Vence el ");
    expect(dueLead("DUE_SOON")).toBe("Vence el ");
  });
});

describe("groupDeadlines", () => {
  it("orders the groups by urgency and leaves out the empty ones", () => {
    const groups = groupDeadlines(ALL_DEADLINES);
    expect(groups.map((group) => group.status)).toEqual([
      "OVERDUE",
      "DUE_SOON",
      "RUNNING",
      "NOT_CALCULABLE",
      "SUSPENDED",
      "MET",
    ]);
    expect(groupDeadlines([DEADLINE_MEDIATION_MUESTRA]).map((group) => group.status)).toEqual([
      "OVERDUE",
    ]);
  });

  it("puts detainee deadlines first inside a group, keeping the backend order otherwise", () => {
    const due = groupDeadlines([
      DEADLINE_INVESTIGATION_DIEGO,
      DEADLINE_CONTROL_LUCAS,
      DEADLINE_REVIEW_CARLA,
    ]).find((group) => group.status === "DUE_SOON");
    expect(due?.items.map((item) => item.id)).toEqual([
      DEADLINE_CONTROL_LUCAS.id,
      DEADLINE_REVIEW_CARLA.id,
      DEADLINE_INVESTIGATION_DIEGO.id,
    ]);
  });
});

describe("remainingLabel", () => {
  it("counts an hour-based term in hours for its last two days", () => {
    expect(remainingLabel(DEADLINE_CONTROL_LUCAS)).toBe("Quedan 15 horas");
    expect(remainingLabel(with_(DEADLINE_CONTROL_LUCAS, { hoursLeft: 1 }))).toBe("Queda 1 hora");
    expect(remainingLabel(with_(DEADLINE_CONTROL_LUCAS, { hoursLeft: 0, daysLeft: 0 }))).toBe(
      "Queda menos de una hora",
    );
    expect(remainingLabel(with_(DEADLINE_CONTROL_LUCAS, { hoursLeft: 60, daysLeft: 3 }))).toBe(
      "Quedan 3 días",
    );
  });

  it("counts day-based terms in days, with today and tomorrow in words", () => {
    expect(remainingLabel(DEADLINE_REVIEW_CARLA)).toBe("Vence mañana");
    expect(remainingLabel(with_(DEADLINE_REVIEW_CARLA, { daysLeft: 0, hoursLeft: 13 }))).toBe(
      "Vence hoy",
    );
    expect(remainingLabel(DEADLINE_INVESTIGATION_DIEGO)).toBe("Quedan 6 días");
    expect(remainingLabel(DEADLINE_JUDICIAL_MODELO)).toBe("Quedan 17 días");
  });

  it("says how long ago an overdue term ended", () => {
    expect(remainingLabel(DEADLINE_MEDIATION_MUESTRA)).toBe("Venció hace 3 días");
    expect(
      remainingLabel(with_(DEADLINE_MEDIATION_MUESTRA, { daysLeft: -1, hoursLeft: -20 })),
    ).toBe("Venció ayer");
    const overdueHours = with_(DEADLINE_CONTROL_LUCAS, {
      status: "OVERDUE",
      daysLeft: 0,
      hoursLeft: -5,
    });
    expect(remainingLabel(overdueHours)).toBe("Venció hace 5 horas");
    expect(remainingLabel(with_(overdueHours, { hoursLeft: 0 }))).toBe(
      "Venció hace menos de una hora",
    );
  });

  it("has nothing to count without a date", () => {
    expect(remainingLabel(DEADLINE_APPEAL_MUESTRA)).toBeNull();
    expect(remainingLabel(with_(DEADLINE_REVIEW_CARLA, { status: "MET" }))).toBeNull();
  });
});

describe("dates", () => {
  it("shows the time of an hour-based term in the firm's zone and only the day otherwise", () => {
    expect(dueLabel(DEADLINE_CONTROL_LUCAS, FIRM_TIME_ZONE)).toBe(
      "Martes 24 de noviembre de 2026, 02:00",
    );
    expect(dueLabel(DEADLINE_REVIEW_CARLA, FIRM_TIME_ZONE)).toBe("Martes 24 de noviembre de 2026");
    expect(dueLabel(DEADLINE_APPEAL_MUESTRA, FIRM_TIME_ZONE)).toBeNull();
    expect(triggeredLabel(DEADLINE_CONTROL_LUCAS, FIRM_TIME_ZONE)).toBe("23/11/2026, 02:00");
    expect(triggeredLabel(DEADLINE_REVIEW_CARLA, FIRM_TIME_ZONE)).toBe("19/11/2026");
  });
});

describe("computationLabel", () => {
  it("says how the term is counted in plain words", () => {
    expect(computationLabel("HOURS", 24)).toBe("24 horas corridas");
    expect(computationLabel("BUSINESS_DAYS", 5)).toBe("5 días hábiles");
    expect(computationLabel("BUSINESS_DAYS", 1)).toBe("1 día hábil");
    expect(computationLabel("CALENDAR_DAYS", 60)).toBe("60 días corridos");
    expect(computationLabel("MONTHS", 8)).toBe("8 meses");
    expect(computationLabel("YEARS", 1)).toBe("1 año");
    expect(computationLabel("SET_BY_COURT", null)).toBe("Fecha que fijó el juez o la fiscalía");
    expect(computationLabel("MONTHS", null)).toBe("En meses");
  });
});

describe("extensions and calendar", () => {
  it("counts the extensions and describes each one", () => {
    const { extensions } = DEADLINE_INVESTIGATION_DIEGO;
    expect(extensionsLabel(extensions)).toBe("1 prórroga concedida");
    expect(extensionsLabel([...extensions, ...extensions])).toBe("2 prórrogas concedidas");
    const [first] = extensions;
    expect(first && extensionDetail(first, "MONTHS")).toBe(
      "Juez de garantías: 4 meses, concedida el 20/07/2026",
    );
  });

  it("explains which court calendar is missing", () => {
    expect(notCalculableText(2027)).toContain("el calendario judicial de 2027");
    expect(notCalculableText(null)).toContain("el calendario judicial del período");
  });
});

describe("deadlinesSummary", () => {
  it("speaks in second person, with the detainees and the horizon", () => {
    expect(deadlinesSummary({ count: 6, detained: 2, days: 30, onlyDetained: false })).toBe(
      "Tenés 6 plazos para atender en los próximos 30 días, 2 de personas detenidas.",
    );
    expect(deadlinesSummary({ count: 1, detained: 0, days: 7, onlyDetained: false })).toBe(
      "Tenés 1 plazo para atender en los próximos 7 días.",
    );
    expect(deadlinesSummary({ count: 0, detained: 0, days: 15, onlyDetained: false })).toBe(
      "No hay plazos en los próximos 15 días.",
    );
    expect(deadlinesSummary({ count: 2, detained: 2, days: 30, onlyDetained: true })).toBe(
      "Tenés 2 plazos de personas detenidas para atender en los próximos 30 días.",
    );
  });
});

describe("parseDeadlineSearch", () => {
  it("keeps only the offered horizons and leaves the default out", () => {
    expect(parseDeadlineSearch({ dias: 7 })).toEqual({ dias: 7, detenidos: undefined });
    expect(parseDeadlineSearch({ dias: "60", detenidos: "si" })).toEqual({
      dias: 60,
      detenidos: "si",
    });
    expect(parseDeadlineSearch({ dias: 30 })).toEqual({ dias: undefined, detenidos: undefined });
    expect(parseDeadlineSearch({ dias: 9, detenidos: "no" })).toEqual({
      dias: undefined,
      detenidos: undefined,
    });
    expect(parseDeadlineSearch({ dias: [7] }).dias).toBeUndefined();
  });

  it("drops the default from a new search", () => {
    expect(horizonSearch({ dias: 7, detenidos: "si" }, 30)).toEqual({
      dias: undefined,
      detenidos: "si",
    });
    expect(horizonSearch({}, 15)).toEqual({ dias: 15 });
  });
});
