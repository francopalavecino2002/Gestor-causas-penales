/*
 * Fictitious practice areas (ADR-0032) for the Vitest suite and the Playwright mock backend: the
 * criminal area of the demo and a draft civil one, with the civil catalogs. Names and captions are
 * made up. Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  AnyCatalogId,
  CatalogItem,
  CatalogView,
  ReviewFlag,
} from "../features/catalogs/catalog-types";
import type { CaseDetail, CaseView } from "../features/cases/case-types";
import type {
  PracticeArea,
  PracticeAreaOption,
} from "../features/practice-areas/practice-area-types";
import { LAWYER_LUCIA } from "./agenda-fixtures";

export const PENAL_AREA: PracticeArea = {
  code: "penal",
  name: "Penal",
  law: "CPP de Neuquén (Ley 2784)",
  reviewedOn: "2026-11-21",
  source: "docs/domain/neuquen-review.md §2",
  flags: [],
  note: null,
  modules: [
    "defendants",
    "coercive-measures",
    "detainee-alerts",
    "alternative-outcomes",
    "mpf-legajo",
  ],
};

export const CIVIL_AREA: PracticeArea = {
  code: "civil",
  name: "Civil y comercial",
  law: "CPCyC de Neuquén (Ley 3551)",
  reviewedOn: "2026-11-24",
  source: "docs/domain/neuquen-otros-fueros.md",
  flags: ["validar", "no-verificado"],
  note: "Borrador sin validar: los catálogos son genéricos y no hay plazos calculados.",
  modules: [],
};

export const LABORAL_AREA: PracticeArea = {
  code: "laboral",
  name: "Laboral",
  law: "Procedimiento laboral de Neuquén",
  reviewedOn: "2026-11-24",
  source: "docs/domain/neuquen-otros-fueros.md",
  flags: ["validar", "no-verificado"],
  note: "Borrador sin validar.",
  modules: [],
};

/** Every area of the package, as `GET /practice-areas/available` lists them. */
export function availableAreas(enabled: string[]): PracticeAreaOption[] {
  return [PENAL_AREA, CIVIL_AREA, LABORAL_AREA].map((area) => ({
    ...area,
    enabled: enabled.includes(area.code),
  }));
}

const item = (code: string, name: string, flags: ReviewFlag[] = ["validar"]): CatalogItem => ({
  code,
  name,
  sourceName: name,
  article: null,
  flags,
  note: null,
  origin: "JURISDICTION",
  hidden: false,
});

const catalog = (id: AnyCatalogId, items: CatalogItem[]): CatalogView => ({
  catalog: id,
  jurisdiction: "neuquen",
  packageVersion: 1,
  source: "docs/domain/neuquen-otros-fueros.md §2",
  flags: ["validar"],
  note: null,
  hideable: id === "hearing-types",
  extensible: id === "hearing-types",
  items,
});

/** The civil catalogs (a short, generic draft, every item flagged). */
export const CIVIL_CATALOGS: CatalogView[] = [
  catalog("stages", [
    item("inicio", "Inicio"),
    item("contestacion", "Contestación"),
    item("prueba", "Prueba"),
    item("sentencia", "Sentencia"),
    item("cerrada", "Cerrada"),
  ]),
  catalog("hearing-types", [
    item("preliminar", "Audiencia preliminar"),
    item("de-prueba", "Audiencia de prueba o vista de causa"),
    item("otra", "Otra audiencia"),
  ]),
  catalog("hearing-statuses", [
    item("solicitada", "Solicitada"),
    item("programada", "Programada"),
    item("reprogramada", "Reprogramada"),
    item("efectiva", "Realizada (efectiva)"),
    item("suspendida", "Suspendida por el juez"),
    item("cancelada", "Cancelada"),
  ]),
  catalog("cancellation-reasons", [item("acuerdo-de-las-partes", "Acuerdo de las partes")]),
  catalog("closing-outcomes", [item("sentencia", "Sentencia"), item("acuerdo", "Acuerdo")]),
  catalog("party-roles", [
    item("actor", "Actor"),
    item("demandado", "Demandado"),
    item("tercero", "Tercero"),
    item("testigo", "Testigo"),
  ]),
  catalog("action-types", [
    item("ordinario", "Proceso ordinario"),
    item("sumarisimo", "Proceso sumarísimo"),
  ]),
  catalog("represented-sides", [
    item("actor", "Parte actora"),
    item("demandado", "Parte demandada"),
  ]),
];

/** A civil case of the firm: no defendants, its own stage, the actor as client. */
export const CASE_CIVIL: CaseView = {
  id: "00000000-0000-4000-a000-000000000201",
  practiceArea: "civil",
  modules: [],
  caption: "Ficticio, Juan c/ Ejemplo S.A. s/ cobro de pesos",
  internalNumber: "CIV-DEMO 12/2026",
  mpfLegajo: null,
  ofijuNumber: null,
  pehuenNumber: null,
  circumscriptionCode: "confluencia",
  circumscriptionName: "I Circunscripción, Confluencia",
  actionType: "ordinario",
  actionArticle: null,
  represents: "actor",
  stageCode: "prueba",
  stageName: "Prueba",
  status: "ACTIVE",
  closingOutcomeCode: null,
  closingOutcomeName: null,
  reserved: false,
  archived: false,
  createdAt: "2026-08-10T14:00:00Z",
  summary: {
    defendantCount: 0,
    openDefendantCount: 0,
    mostDelayedStage: "prueba",
    detaineeCount: 0,
    nextHearing: null,
  },
};

export const DETAIL_CIVIL: CaseDetail = {
  ...CASE_CIVIL,
  customFields: {},
  team: [{ userId: LAWYER_LUCIA.id, displayName: LAWYER_LUCIA.name, role: "RESPONSIBLE" }],
  parties: [
    {
      id: "00000000-0000-4000-d000-000000000201",
      personId: "00000000-0000-4000-8000-000000000921",
      displayName: "Juan Ficticio",
      personArchived: false,
      roleCode: "actor",
      roleName: "Actor",
    },
    {
      id: "00000000-0000-4000-d000-000000000202",
      personId: "00000000-0000-4000-8000-000000000922",
      displayName: "Ejemplo S.A.",
      personArchived: false,
      roleCode: "demandado",
      roleName: "Demandado",
    },
  ],
  defendants: [],
};

/** The catalog a fake backend serves for `?area=`: the civil one, or the criminal fixtures. */
export function areaCatalog(
  id: string,
  area: string | null | undefined,
  criminal: CatalogView[],
): CatalogView | undefined {
  if (area === "civil") {
    return (
      CIVIL_CATALOGS.find((view) => view.catalog === id) ??
      // Shared by every area: the circumscriptions.
      criminal.find((view) => view.catalog === id && id === "circumscriptions")
    );
  }
  return criminal.find((view) => view.catalog === id);
}
