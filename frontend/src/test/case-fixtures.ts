/*
 * Fictitious cases of the demo firm, shared by the Vitest suite and the Playwright mock backend.
 * Names, captions, legajos and rooms are made up; any resemblance is accidental. The first case
 * is the one of the agenda's 11:00 hearing (agenda-fixtures.ts), so the agenda links to it.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type { CatalogId, CatalogItem, CatalogView } from "../features/catalogs/catalog-types";
import type {
  CaseDetail,
  CaseHearing,
  CasePage,
  CaseView,
  CoerciveMeasure,
  DefendantView,
} from "../features/cases/case-types";
import { LAWYER_HUGO, LAWYER_LUCIA, LAWYER_PAULA, MONDAY_HEARINGS } from "./agenda-fixtures";

const id = (group: string, n: number) =>
  `00000000-0000-4000-${group}-${String(n).padStart(12, "0")}`;

const item = (code: string, name: string, article: string | null = null): CatalogItem => ({
  code,
  name,
  sourceName: name,
  article,
  flags: [],
  note: null,
  origin: "JURISDICTION",
  hidden: false,
});

const catalog = (catalogId: CatalogId, items: CatalogItem[]): CatalogView => ({
  catalog: catalogId,
  jurisdiction: "neuquen",
  packageVersion: 1,
  source: "CPP de Neuquén (Ley 2784)",
  flags: [],
  note: null,
  hideable: catalogId === "hearing-types",
  extensible: catalogId === "hearing-types",
  items,
});

export const CATALOGS: Record<CatalogId, CatalogView> = {
  stages: catalog("stages", [
    item("averiguacion-preliminar", "Averiguación preliminar y valoración inicial", "129 a 132"),
    item("investigacion-preparatoria", "Investigación preparatoria", "133 a 158"),
    item("etapa-intermedia", "Etapa intermedia o control de acusación", "164 a 173"),
    item("juicio", "Juicio", "34, 35 y 181 a 212"),
    item("cerrada", "Cerrada"),
  ]),
  "hearing-types": catalog("hearing-types", [
    item("formulacion-de-cargos", "Formulación de cargos", "133"),
    item("revision-de-prision-preventiva", "Revisión de prisión preventiva", "118"),
    item("control-de-acusacion", "Control de acusación", "167 a 169"),
    item("juicio-tecnico", "Juicio técnico", "181 a 196"),
  ]),
  "liberty-situations": catalog("liberty-situations", [
    item("en-libertad-sin-medidas", "En libertad sin medidas"),
    item("en-libertad-con-medidas", "En libertad con medidas", "113"),
    item("detencion-domiciliaria", "Detenido en domiciliaria", "113"),
    item("prision-preventiva", "En prisión preventiva", "113 y 119"),
    item("profugo-o-rebelde", "Prófugo o rebelde", "52"),
  ]),
};

function caseView(overrides: Partial<CaseView> & Pick<CaseView, "id" | "caption">): CaseView {
  return {
    internalNumber: null,
    mpfLegajo: null,
    ofijuNumber: null,
    pehuenNumber: null,
    circumscriptionCode: "confluencia",
    circumscriptionName: "I Circunscripción, Confluencia",
    actionType: "PUBLIC",
    actionArticle: "99",
    represents: "DEFENCE",
    reserved: false,
    archived: false,
    createdAt: "2026-05-10T14:00:00Z",
    summary: {
      defendantCount: 1,
      openDefendantCount: 1,
      mostDelayedStage: "investigacion-preparatoria",
      detaineeCount: 0,
      nextHearing: null,
    },
    ...overrides,
  };
}

const MODELO_HEARING = MONDAY_HEARINGS[2];
const EJEMPLAR_HEARING = MONDAY_HEARINGS[3];

/** Carla Modelo, in preventive prison; review hearing today at 11:00. */
export const CASE_MODELO: CaseView = caseView({
  id: MODELO_HEARING?.caseId ?? id("a000", 3),
  caption: "Modelo, Carla s/ homicidio en grado de tentativa",
  internalNumber: "DEMO-0098/2026",
  mpfLegajo: "MPFNQ 10234/2026",
  ofijuNumber: "OFI-DEMO 4521/2026",
  pehuenNumber: "PEH-DEMO 7788",
  summary: {
    defendantCount: 1,
    openDefendantCount: 1,
    mostDelayedStage: "investigacion-preparatoria",
    detaineeCount: 1,
    nextHearing: {
      id: MODELO_HEARING?.hearingId ?? id("9000", 3),
      startsAt: MODELO_HEARING?.startsAt ?? "2026-11-23T14:00:00Z",
      typeCode: "revision-de-prision-preventiva",
    },
  },
});

/** Two defendants, reserved; one of them declared in rebellion. */
export const CASE_EJEMPLAR: CaseView = caseView({
  id: EJEMPLAR_HEARING?.caseId ?? id("a000", 4),
  caption: "Ejemplar, Diego y otra s/ defraudación",
  mpfLegajo: "MPFNQ 8812/2025",
  reserved: true,
  actionType: "PUBLIC_ON_COMPLAINT",
  actionArticle: "100",
  summary: {
    defendantCount: 2,
    openDefendantCount: 2,
    mostDelayedStage: "investigacion-preparatoria",
    detaineeCount: 0,
    nextHearing: {
      id: EJEMPLAR_HEARING?.hearingId ?? id("9000", 4),
      startsAt: EJEMPLAR_HEARING?.startsAt ?? "2026-11-23T14:30:00Z",
      typeCode: "control-de-acusacion",
    },
  },
});

export const CASE_MUESTRA: CaseView = caseView({
  id: id("a000", 101),
  caption: "Muestra, Julián s/ lesiones leves",
  mpfLegajo: "MPFZA 2210/2026",
  circumscriptionCode: "comarca",
  circumscriptionName: "IV Circunscripción, de la Comarca",
  summary: {
    defendantCount: 1,
    openDefendantCount: 1,
    mostDelayedStage: "averiguacion-preliminar",
    detaineeCount: 0,
    nextHearing: null,
  },
});

export const CASE_EJEMPLO: CaseView = caseView({
  id: MONDAY_HEARINGS[4]?.caseId ?? id("a000", 5),
  caption: "Ejemplo, Lucas s/ robo agravado",
  mpfLegajo: "MPFNQ 15002/2025",
  summary: {
    defendantCount: 1,
    openDefendantCount: 1,
    mostDelayedStage: "juicio",
    detaineeCount: 1,
    nextHearing: {
      id: MONDAY_HEARINGS[4]?.hearingId ?? id("9000", 5),
      startsAt: MONDAY_HEARINGS[4]?.startsAt ?? "2026-11-23T19:00:00Z",
      typeCode: "juicio-tecnico",
    },
  },
});

/** Archived: shows only with "Incluí las archivadas". */
export const CASE_ARCHIVED: CaseView = caseView({
  id: id("a000", 102),
  caption: "Prueba, Ana s/ hurto simple",
  mpfLegajo: "MPFNQ 301/2024",
  archived: true,
  summary: {
    defendantCount: 1,
    openDefendantCount: 0,
    mostDelayedStage: "cerrada",
    detaineeCount: 0,
    nextHearing: null,
  },
});

export const CASES: CaseView[] = [
  CASE_MODELO,
  CASE_EJEMPLAR,
  CASE_EJEMPLO,
  CASE_MUESTRA,
  CASE_ARCHIVED,
];

/** `count` plain cases, to page through. */
export function manyCases(count: number): CaseView[] {
  return Array.from({ length: count }, (_, index) =>
    caseView({
      id: id("a100", index + 1),
      caption: `Ficticio ${String(index + 1).padStart(2, "0")}, Caso s/ daño`,
      mpfLegajo: `MPFNQ ${1000 + index}/2026`,
    }),
  );
}

function defendant(
  overrides: Partial<DefendantView> & Pick<DefendantView, "id" | "displayName">,
): DefendantView {
  return {
    personId: id("8000", Number(overrides.id.slice(-3))),
    personArchived: false,
    stageCode: "investigacion-preparatoria",
    stageName: "Investigación preparatoria",
    status: "ACTIVE",
    closingOutcomeCode: null,
    closingOutcomeName: null,
    chargesFormulatedOn: null,
    defendedByFirm: true,
    defenceCounselKind: null,
    defenceCounselName: null,
    rebellionDeclaredOn: null,
    rebellionLiftedOn: null,
    indigenousPeople: null,
    createdAt: "2026-05-10T14:00:00Z",
    charges: [],
    customFields: {},
    ...overrides,
  };
}

export const DEFENDANT_CARLA = defendant({
  id: id("c000", 1),
  displayName: "Carla Modelo",
  chargesFormulatedOn: "2026-05-12",
  charges: [
    {
      id: id("c100", 1),
      offence: "Homicidio en grado de tentativa",
      legalReference: "CP arts. 79 y 42",
    },
  ],
});

export const DEFENDANT_DIEGO = defendant({
  id: id("c000", 2),
  displayName: "Diego Ejemplar",
  stageCode: "etapa-intermedia",
  stageName: "Etapa intermedia o control de acusación",
  chargesFormulatedOn: "2025-09-03",
  charges: [{ id: id("c100", 2), offence: "Defraudación", legalReference: "CP art. 173" }],
});

export const DEFENDANT_NORA = defendant({
  id: id("c000", 3),
  displayName: "Nora Ficticia",
  defendedByFirm: false,
  defenceCounselKind: "PUBLIC",
  defenceCounselName: "Defensoría Pública ficticia 2",
  rebellionDeclaredOn: "2026-08-01",
  charges: [{ id: id("c100", 3), offence: "Defraudación", legalReference: "CP art. 173" }],
});

const TEAM = [
  { userId: LAWYER_HUGO.id, displayName: LAWYER_HUGO.name, role: "COLLABORATOR" as const },
  { userId: LAWYER_LUCIA.id, displayName: LAWYER_LUCIA.name, role: "RESPONSIBLE" as const },
];

export const DETAIL_MODELO: CaseDetail = {
  ...CASE_MODELO,
  customFields: {},
  team: TEAM,
  parties: [
    {
      id: id("d000", 1),
      personId: id("8000", 901),
      displayName: "Raúl Ficticio",
      personArchived: false,
      roleCode: "victima",
      roleName: "Víctima",
    },
    {
      id: id("d000", 2),
      personId: id("8000", 902),
      displayName: "Dra. Marta Ejemplo",
      personArchived: false,
      roleCode: "fiscal",
      roleName: "Fiscal",
    },
  ],
  defendants: [DEFENDANT_CARLA],
};

export const DETAIL_EJEMPLAR: CaseDetail = {
  ...CASE_EJEMPLAR,
  customFields: {},
  team: [{ userId: LAWYER_PAULA.id, displayName: LAWYER_PAULA.name, role: "RESPONSIBLE" }],
  parties: [],
  defendants: [DEFENDANT_DIEGO, DEFENDANT_NORA],
};

export const ARCHIVED_DETAIL: CaseDetail = {
  ...CASE_ARCHIVED,
  customFields: {},
  team: TEAM,
  parties: [],
  defendants: [
    defendant({
      id: id("c000", 4),
      displayName: "Ana Prueba",
      stageCode: "cerrada",
      stageName: "Cerrada",
      status: "CLOSED",
      closingOutcomeCode: "sobreseimiento",
      closingOutcomeName: "Sobreseimiento",
    }),
  ],
};

export const DETAILS: CaseDetail[] = [DETAIL_MODELO, DETAIL_EJEMPLAR, ARCHIVED_DETAIL];

export const MEASURES: Record<string, CoerciveMeasure[]> = {
  [DEFENDANT_CARLA.id]: [
    {
      id: id("e000", 1),
      defendantId: DEFENDANT_CARLA.id,
      measureCode: "prision-preventiva",
      measureName: "Prisión preventiva",
      measureArticle: "114 a 119",
      conditions: null,
      detentionPlace: "Unidad de detención ficticia 11",
      proceduralRisks: [{ code: "peligro-de-fuga", name: "Peligro de fuga" }],
      startsOn: "2026-05-12",
      endsOn: "2026-12-04",
      nextReviewOn: "2026-11-25",
      orderedByHearingId: id("9100", 1),
      liftedOn: null,
      active: true,
      archived: false,
      createdAt: "2026-05-12T18:00:00Z",
    },
  ],
};

function caseHearing(overrides: Partial<CaseHearing> & Pick<CaseHearing, "id" | "startsAt">) {
  return {
    caseId: CASE_MODELO.id,
    caseCaption: CASE_MODELO.caption,
    typeCode: "formulacion-de-cargos",
    typeName: "Formulación de cargos",
    typeArticle: "133",
    durationMinutes: 60,
    room: "Sala 5, Ciudad Judicial",
    judge: "Dra. Silvia Muestra",
    ofijuReference: null,
    requestedBy: "OFIJU",
    statusCode: "programada",
    statusName: "Programada",
    cancellationReasonCode: null,
    cancellationReasonName: null,
    heldAsTypeCode: null,
    heldAsTypeName: null,
    resultSummary: null,
    nextHearingId: null,
    notes: null,
    archived: false,
    createdAt: "2026-05-10T14:00:00Z",
    defendants: [{ id: DEFENDANT_CARLA.personId, name: DEFENDANT_CARLA.displayName }],
    lawyers: [LAWYER_LUCIA],
    ...overrides,
  } satisfies CaseHearing;
}

/** Newest first, as the backend answers. */
export const HEARINGS_BY_CASE: Record<string, CaseHearing[]> = {
  [CASE_MODELO.id]: [
    caseHearing({
      id: MODELO_HEARING?.hearingId ?? id("9000", 3),
      startsAt: MODELO_HEARING?.startsAt ?? "2026-11-23T14:00:00Z",
      typeCode: "revision-de-prision-preventiva",
      typeName: "Revisión de prisión preventiva",
      typeArticle: "118",
    }),
    caseHearing({
      id: id("9100", 1),
      startsAt: "2026-05-12T12:00:00Z",
      typeCode: "formulacion-de-cargos",
      statusCode: "efectiva",
      statusName: "Efectiva",
      resultSummary: "Se formularon cargos y se dictó prisión preventiva por seis meses.",
    }),
  ],
};

/** What `GET /api/v1/cases` answers, filtered and paged like the real search. */
export function casePageFor(
  cases: CaseView[],
  query: { q?: string | null; includeArchived?: boolean; page?: number; size?: number },
): CasePage {
  const size = query.size ?? 20;
  const page = query.page ?? 0;
  const text = query.q?.trim().toLocaleLowerCase("es-AR") ?? "";
  const matches = cases.filter(
    (item) =>
      (query.includeArchived || !item.archived) &&
      (!text ||
        item.caption.toLocaleLowerCase("es-AR").includes(text) ||
        (item.mpfLegajo ?? "").toLocaleLowerCase("es-AR").includes(text)),
  );
  return {
    items: matches.slice(page * size, page * size + size),
    page,
    size,
    total: matches.length,
  };
}
