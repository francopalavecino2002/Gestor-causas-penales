/*
 * Fictitious agenda for the week of Monday 23 November 2026, shared by the Vitest suite and the
 * Playwright mock backend. Names, captions and rooms are made up; any resemblance is accidental.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  AgendaItem,
  AgendaView,
  DetaineeAlert,
  NamedRef,
} from "../features/agenda/agenda-types";
import { FIRM_TIME_ZONE, localDay } from "../features/agenda/agenda-dates";

/** Monday 23 November 2026, 10:20 in Neuquén (UTC−3). */
export const FIXTURE_NOW = "2026-11-23T13:20:00Z";

/** Same id as DEMO_ME in the test helpers: the signed-in user. */
export const LAWYER_LUCIA: NamedRef = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Lucía Ejemplo",
};
export const LAWYER_PAULA: NamedRef = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Paula Demo",
};
export const LAWYER_HUGO: NamedRef = {
  id: "00000000-0000-4000-8000-000000000003",
  name: "Hugo Prueba",
};

const person = (n: number, name: string): NamedRef => ({
  id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
  name,
});

const MARTIN = person(1, "Martín Ficticio");
const JULIAN = person(2, "Julián Muestra");
const CARLA = person(3, "Carla Modelo");
const DIEGO = person(4, "Diego Ejemplar");
const NORA = person(5, "Nora Ficticia");
const LUCAS = person(6, "Lucas Ejemplo");

let sequence = 0;

/**
 * A hearing with sensible defaults; `local` is the Neuquén wall-clock time, e.g.
 * "2026-11-23T09:30" (written with its fixed UTC−3 offset: Argentina has no daylight saving).
 */
export function hearing(local: string, overrides: Partial<AgendaItem> = {}): AgendaItem {
  sequence += 1;
  const id = String(sequence).padStart(12, "0");
  return {
    hearingId: `00000000-0000-4000-9000-${id}`,
    caseId: `00000000-0000-4000-a000-${id}`,
    caseCaption: "Ficticio, Martín s/ robo simple",
    typeCode: "formulacion-de-cargos",
    typeName: "Formulación de cargos",
    typeArticle: "133",
    statusCode: "programada",
    statusName: "Programada",
    startsAt: new Date(`${local}:00-03:00`).toISOString(),
    durationMinutes: 60,
    room: "Sala 2, Ciudad Judicial",
    judge: "Dr. Andrés Ejemplo",
    defendants: [MARTIN],
    lawyers: [LAWYER_LUCIA],
    detainee: false,
    hasClash: false,
    ...overrides,
  };
}

export const MONDAY_HEARINGS: AgendaItem[] = [
  hearing("2026-11-23T08:30", {
    statusCode: "efectiva",
    statusName: "Efectiva",
    durationMinutes: 45,
  }),
  hearing("2026-11-23T09:45", {
    caseCaption: "Muestra, Julián s/ lesiones leves",
    typeCode: "suspension-de-juicio-a-prueba",
    typeName: "Suspensión de juicio a prueba",
    typeArticle: "108",
    statusCode: "suspendida",
    statusName: "Suspendida",
    durationMinutes: 30,
    room: "Sala 4, Ciudad Judicial",
    judge: null,
    defendants: [JULIAN],
    lawyers: [LAWYER_HUGO],
  }),
  hearing("2026-11-23T11:00", {
    caseCaption: "Modelo, Carla s/ homicidio en grado de tentativa",
    typeCode: "revision-de-prision-preventiva",
    typeName: "Revisión de prisión preventiva",
    typeArticle: "118",
    room: "Sala 5, Ciudad Judicial",
    judge: "Dra. Silvia Muestra",
    defendants: [CARLA],
    lawyers: [LAWYER_LUCIA, LAWYER_HUGO],
    detainee: true,
    hasClash: true,
  }),
  hearing("2026-11-23T11:30", {
    caseCaption: "Ejemplar, Diego y otra s/ defraudación",
    typeCode: "control-de-acusacion",
    typeName: "Control de acusación",
    typeArticle: "167 a 169",
    statusCode: "reprogramada",
    statusName: "Reprogramada",
    durationMinutes: 90,
    room: "Sala 3, Ciudad Judicial",
    defendants: [DIEGO, NORA],
    hasClash: true,
  }),
  hearing("2026-11-23T16:00", {
    caseCaption: "Ejemplo, Lucas s/ robo agravado",
    typeCode: "juicio-tecnico",
    typeName: "Juicio técnico",
    typeArticle: "181 a 196",
    durationMinutes: 180,
    room: "Sala 1, Ciudad Judicial",
    judge: "Dra. Silvia Muestra",
    defendants: [LUCAS],
    lawyers: [LAWYER_PAULA],
    detainee: true,
  }),
];

export const WEEK_HEARINGS: AgendaItem[] = [
  ...MONDAY_HEARINGS,
  hearing("2026-11-24T09:00", {
    caseCaption: "Ejemplar, Diego y otra s/ defraudación",
    typeCode: "control-de-la-investigacion",
    typeName: "Control de la investigación",
    typeArticle: "36 inc. 1",
    room: "Sala 6, Ciudad Judicial",
    defendants: [NORA],
    lawyers: [LAWYER_PAULA],
  }),
  hearing("2026-11-25T10:30", {
    caseCaption: "Ejemplo, Lucas s/ robo agravado",
    typeCode: "detencion-y-medida-de-coercion",
    typeName: "Detención y medida de coerción",
    typeArticle: "112, 113 y 116",
    statusCode: "solicitada",
    statusName: "Solicitada",
    room: null,
    judge: null,
    defendants: [LUCAS],
    detainee: true,
  }),
  hearing("2026-11-27T08:00", {
    caseCaption: "Muestra, Julián s/ lesiones leves",
    typeCode: "otra",
    typeName: "Otra",
    typeArticle: null,
    durationMinutes: 30,
    room: "Sala 2, Zapala",
    judge: "Dr. Andrés Ejemplo",
    defendants: [JULIAN],
    lawyers: [LAWYER_HUGO],
  }),
];

export const DETAINEE_ALERTS: DetaineeAlert[] = [
  {
    kind: "REVIEW",
    dueOn: "2026-11-25",
    daysLeft: 2,
    article: "118",
    caseId: MONDAY_HEARINGS[2]?.caseId ?? "",
    caseCaption: "Modelo, Carla s/ homicidio en grado de tentativa",
    defendantId: CARLA.id,
    defendantName: CARLA.name,
    measureId: "00000000-0000-4000-b000-000000000001",
    disclaimer: "Cálculo asistido: verificá con la norma.",
  },
  {
    kind: "ENDS",
    dueOn: "2026-12-04",
    daysLeft: 11,
    article: "116",
    caseId: MONDAY_HEARINGS[4]?.caseId ?? "",
    caseCaption: "Ejemplo, Lucas s/ robo agravado",
    defendantId: LUCAS.id,
    defendantName: LUCAS.name,
    measureId: "00000000-0000-4000-b000-000000000002",
    disclaimer: "Cálculo asistido: verificá con la norma.",
  },
];

/** What the backend answers for a range, filtered like the real query (local days, lawyer). */
export function agendaFor(
  items: AgendaItem[],
  from: string,
  to: string,
  lawyerId?: string | null,
): AgendaView {
  return {
    from,
    to,
    timeZone: FIRM_TIME_ZONE,
    items: items.filter((item) => {
      const day = localDay(item.startsAt, FIRM_TIME_ZONE);
      const inRange = day >= from && day <= to;
      return inRange && (!lawyerId || item.lawyers.some((lawyer) => lawyer.id === lawyerId));
    }),
  };
}
