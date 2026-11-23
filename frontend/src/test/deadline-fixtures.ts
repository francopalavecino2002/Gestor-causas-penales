/*
 * Fictitious deadlines of the demo firm, shared by the Vitest suite and the Playwright mock
 * backend. They hang from the fictitious cases (case-fixtures.ts) and are computed as the backend
 * would at FIXTURE_NOW (Monday 23 November 2026, 10:20 in Neuquén). Rule names, sources and case
 * law come from the Neuquén package (backend deadline-rules.yml); people and cases are made up.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  DeadlineRuleRef,
  DeadlineStatus,
  DeadlineView,
} from "../features/deadlines/deadline-types";
import {
  CASE_EJEMPLAR,
  CASE_EJEMPLO,
  CASE_MODELO,
  CASE_MUESTRA,
  DEFENDANT_CARLA,
  DEFENDANT_DIEGO,
  DEFENDANT_NORA,
} from "./case-fixtures";

const DISCLAIMER = "Cálculo asistido: verificá con la norma.";
const LAW = "CPP de Neuquén (Ley 2784)";

const id = (n: number) => `00000000-0000-4000-f000-${String(n).padStart(12, "0")}`;

const rule = (
  overrides: Partial<DeadlineRuleRef> & Pick<DeadlineRuleRef, "code" | "name" | "source">,
): DeadlineRuleRef => ({
  kind: "LEGAL",
  computation: "CALENDAR_DAYS",
  detainee: false,
  consequence: "Sin consecuencia expresa",
  caseLawStatus: "Vigente",
  caseLawUrl: null,
  flags: [],
  enabled: true,
  ...overrides,
});

function deadline(
  overrides: Partial<DeadlineView> &
    Pick<DeadlineView, "id" | "caseId" | "caseCaption" | "rule" | "status" | "triggeredOn">,
): DeadlineView {
  return {
    defendantId: null,
    defendantName: null,
    triggeredAt: null,
    setDueOn: null,
    hearingId: null,
    amount: null,
    dueOn: null,
    dueAt: null,
    daysLeft: null,
    hoursLeft: null,
    suspendedDays: 0,
    missingYear: null,
    extensions: [],
    metOn: null,
    notes: null,
    archived: false,
    createdAt: "2026-05-12T18:00:00Z",
    disclaimer: DISCLAIMER,
    ...overrides,
  };
}

const LUCAS = { id: "00000000-0000-4000-c000-000000000005", name: "Lucas Ejemplo" };

/** 24 h from a detention at 02:00 today: due tomorrow at 02:00, 15 hours left. */
export const DEADLINE_CONTROL_LUCAS = deadline({
  id: id(1),
  caseId: CASE_EJEMPLO.id,
  caseCaption: CASE_EJEMPLO.caption,
  defendantId: LUCAS.id,
  defendantName: LUCAS.name,
  rule: rule({
    code: "control-judicial-detencion",
    name: "Detención sin control judicial",
    source: `Art. 112; 49 inc. 5 · ${LAW}`,
    computation: "HOURS",
    detainee: true,
    consequence: "Libertad",
    caseLawStatus: "Vigente. En 2025 se pidió llevarlo a 48 h en narcomenudeo.",
    flags: ["validar"],
  }),
  triggeredOn: "2026-11-23",
  triggeredAt: "2026-11-23T05:00:00Z",
  amount: 24,
  dueOn: "2026-11-24",
  dueAt: "2026-11-24T05:00:00Z",
  status: "DUE_SOON",
  daysLeft: 1,
  hoursLeft: 15,
});

/** Review of preventive prison asked for on Thursday: 5 calendar days, due tomorrow. */
export const DEADLINE_REVIEW_CARLA = deadline({
  id: id(2),
  caseId: CASE_MODELO.id,
  caseCaption: CASE_MODELO.caption,
  defendantId: DEFENDANT_CARLA.id,
  defendantName: DEFENDANT_CARLA.displayName,
  rule: rule({
    code: "revision-prision-preventiva",
    name: "Audiencia de revisión de prisión preventiva",
    source: `Art. 118 · ${LAW}`,
    detainee: true,
    consequence: "Pronto despacho y, a las 24 h, libertad (art. 120)",
    flags: ["validar"],
  }),
  triggeredOn: "2026-11-19",
  amount: 5,
  dueOn: "2026-11-24",
  dueAt: "2026-11-25T03:00:00Z",
  status: "DUE_SOON",
  daysLeft: 1,
  hoursLeft: 37,
});

/** A year of preventive prison: far ahead, so only the case shows it. */
export const DEADLINE_MAX_CARLA = deadline({
  id: id(3),
  caseId: CASE_MODELO.id,
  caseCaption: CASE_MODELO.caption,
  defendantId: DEFENDANT_CARLA.id,
  defendantName: DEFENDANT_CARLA.displayName,
  rule: rule({
    code: "duracion-maxima-prision-preventiva",
    name: "Duración máxima de la prisión preventiva",
    source: `Art. 119 · ${LAW}`,
    computation: "YEARS",
    detainee: true,
    consequence: "Cese; no se puede dictar otra medida privativa de la libertad",
    caseLawStatus:
      "Vigente. En disputa si corre después de la condena no firme (Instrucción General 7/2015 del MPF).",
    flags: ["validar"],
  }),
  triggeredOn: "2026-05-12",
  amount: 1,
  dueOn: "2027-05-12",
  dueAt: "2027-05-13T03:00:00Z",
  status: "RUNNING",
  daysLeft: 170,
  hoursLeft: 4069,
});

/** Formulación de cargos with Carla detained: done in time back in May. */
export const DEADLINE_CHARGES_CARLA = deadline({
  id: id(4),
  caseId: CASE_MODELO.id,
  caseCaption: CASE_MODELO.caption,
  defendantId: DEFENDANT_CARLA.id,
  defendantName: DEFENDANT_CARLA.displayName,
  rule: rule({
    code: "formulacion-cargos-con-detenido",
    name: "Formulación de cargos con detenido",
    source: `Art. 133 · ${LAW}`,
    computation: "HOURS",
    detainee: true,
    consequence: "Libertad",
  }),
  triggeredOn: "2026-05-11",
  triggeredAt: "2026-05-11T22:30:00Z",
  amount: 24,
  dueOn: "2026-05-12",
  dueAt: "2026-05-12T22:30:00Z",
  status: "MET",
  daysLeft: -195,
  hoursLeft: -4695,
  metOn: "2026-05-12",
});

/** A date the judge set in Carla's case: 17 days ahead. */
export const DEADLINE_JUDICIAL_MODELO = deadline({
  id: id(5),
  caseId: CASE_MODELO.id,
  caseCaption: CASE_MODELO.caption,
  rule: rule({
    code: "plazo-judicial",
    name: "Plazo fijado por el juez o el fiscal",
    source: "Resolución judicial o fiscal",
    kind: "JUDICIAL",
    computation: "SET_BY_COURT",
    consequence: "La que indique la resolución",
    caseLawStatus: "Plazo judicial; se carga a mano la fecha fijada.",
  }),
  triggeredOn: "2026-11-18",
  setDueOn: "2026-12-10",
  dueOn: "2026-12-10",
  dueAt: "2026-12-11T03:00:00Z",
  status: "RUNNING",
  daysLeft: 17,
  hoursLeft: 422,
});

/** Preparatory investigation of Diego: 4 months plus a 4-month extension, due on Sunday. */
export const DEADLINE_INVESTIGATION_DIEGO = deadline({
  id: id(6),
  caseId: CASE_EJEMPLAR.id,
  caseCaption: CASE_EJEMPLAR.caption,
  defendantId: DEFENDANT_DIEGO.id,
  defendantName: DEFENDANT_DIEGO.displayName,
  rule: rule({
    code: "investigacion-preparatoria",
    name: "Duración de la investigación preparatoria",
    source: `Art. 158; 160 inc. 7 · ${LAW}`,
    computation: "MONTHS",
    consequence: "Extinción de la acción y sobreseimiento",
    caseLawStatus:
      "TSJ «Olave» (07/09/2024) declaró inconstitucional la consecuencia (arts. 158 y 160 inc. 7); el plazo sigue vigente.",
    caseLawUrl:
      "https://www.rionegro.com.ar/justicia/el-tsj-de-neuquen-demolio-otro-plazo-para-las-investigaciones-penales-3780038/",
    flags: ["validar", "no-verificado"],
  }),
  triggeredOn: "2026-03-29",
  amount: 8,
  dueOn: "2026-11-29",
  dueAt: "2026-11-30T03:00:00Z",
  status: "DUE_SOON",
  daysLeft: 6,
  hoursLeft: 157,
  extensions: [
    {
      id: id(601),
      step: 1,
      grantedBy: "Juez de garantías",
      amount: 4,
      grantedOn: "2026-07-20",
      grantedByHearingId: null,
      notes: null,
    },
  ],
});

/** Nora was declared in rebellion: her investigation term is stopped. */
export const DEADLINE_INVESTIGATION_NORA = deadline({
  ...DEADLINE_INVESTIGATION_DIEGO,
  id: id(7),
  defendantId: DEFENDANT_NORA.id,
  defendantName: DEFENDANT_NORA.displayName,
  amount: 4,
  extensions: [],
  dueOn: null,
  dueAt: null,
  status: "SUSPENDED",
  daysLeft: null,
  hoursLeft: null,
  suspendedDays: 114,
});

/** Penal mediation of Julián's case: 60 calendar days that ended on Friday. */
export const DEADLINE_MEDIATION_MUESTRA = deadline({
  id: id(8),
  caseId: CASE_MUESTRA.id,
  caseCaption: CASE_MUESTRA.caption,
  rule: rule({
    code: "mediacion-penal",
    name: "Mediación penal",
    source: "Ley 2996",
    consequence: "Suspende los plazos procesales mientras dura",
    caseLawStatus: "Ley aprobada en 2016 según la prensa; no se pudo leer el texto oficial.",
    flags: ["validar"],
  }),
  triggeredOn: "2026-09-21",
  amount: 60,
  dueOn: "2026-11-20",
  dueAt: "2026-11-21T03:00:00Z",
  status: "OVERDUE",
  daysLeft: -3,
  hoursLeft: -58,
});

/** Business days need the court calendar, and the fictitious firm has not loaded 2026's. */
export const DEADLINE_APPEAL_MUESTRA = deadline({
  id: id(9),
  caseId: CASE_MUESTRA.id,
  caseCaption: CASE_MUESTRA.caption,
  rule: rule({
    code: "impugnacion-ordinaria",
    name: "Impugnación ordinaria",
    source: `Art. 242 · ${LAW}`,
    computation: "BUSINESS_DAYS",
    consequence: "Caduca el derecho a impugnar",
    caseLawStatus: "Validar plazo y vigencia.",
    flags: ["validar", "no-verificado"],
  }),
  triggeredOn: "2026-11-20",
  amount: 5,
  status: "NOT_CALCULABLE",
  missingYear: 2026,
});

/**
 * Every deadline, in the backend's order: met last; before them detainee first, then the soonest,
 * those without a date at the end.
 */
export const ALL_DEADLINES: DeadlineView[] = [
  DEADLINE_CONTROL_LUCAS,
  DEADLINE_REVIEW_CARLA,
  DEADLINE_MAX_CARLA,
  DEADLINE_MEDIATION_MUESTRA,
  DEADLINE_INVESTIGATION_DIEGO,
  DEADLINE_JUDICIAL_MODELO,
  DEADLINE_APPEAL_MUESTRA,
  DEADLINE_INVESTIGATION_NORA,
  DEADLINE_CHARGES_CARLA,
];

const NEEDS_ATTENTION: DeadlineStatus[] = ["OVERDUE", "DUE_SOON", "NOT_CALCULABLE"];

/**
 * What `GET /api/v1/deadlines?withinDays=N` answers: overdue, due soon and not calculable ones,
 * plus the running ones due within N days. Met and suspended ones are left out.
 */
export function upcomingDeadlines(
  withinDays: number,
  deadlines: DeadlineView[] = ALL_DEADLINES,
): DeadlineView[] {
  return deadlines.filter(
    (item) =>
      item.rule.enabled &&
      (NEEDS_ATTENTION.includes(item.status) ||
        (item.status === "RUNNING" && item.daysLeft !== null && item.daysLeft <= withinDays)),
  );
}

/** What `GET /api/v1/cases/{id}/deadlines` answers, in the same order. */
export function caseDeadlines(
  caseId: string,
  deadlines: DeadlineView[] = ALL_DEADLINES,
): DeadlineView[] {
  return deadlines.filter((item) => item.caseId === caseId);
}
