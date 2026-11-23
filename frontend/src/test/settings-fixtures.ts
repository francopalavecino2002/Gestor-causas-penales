/*
 * Fictitious settings of the demo firm, shared by the Vitest suite and the Playwright mock
 * backend. Catalog items and deadline rules come from the Neuquén package (legal data); the
 * firm's own items and fields are made up. Relative imports only: the e2e project has no "@/".
 */
import type { CatalogItem, CatalogView } from "../features/catalogs/catalog-types";
import type { CustomField, DeadlineRule } from "../features/settings/settings-types";

const LAW = "CPP de Neuquén (Ley 2784)";
const DISCLAIMER = "Cálculo asistido: verificá con la norma.";

const item = (
  code: string,
  name: string,
  article: string | null,
  extra: Partial<CatalogItem> = {},
): CatalogItem => ({
  code,
  name,
  sourceName: name,
  article,
  flags: [],
  note: null,
  origin: "JURISDICTION",
  hidden: false,
  ...extra,
});

const view = (
  catalog: CatalogView["catalog"],
  rules: { hideable: boolean; extensible: boolean },
  items: CatalogItem[],
): CatalogView => ({
  catalog,
  jurisdiction: "neuquen",
  packageVersion: 1,
  source: LAW,
  flags: [],
  note: null,
  ...rules,
  items,
});

export const SETTINGS_HEARING_TYPES = view("hearing-types", { hideable: true, extensible: true }, [
  item("formulacion-de-cargos", "Formulación de cargos", "133"),
  item("revision-de-prision-preventiva", "Revisión de la preventiva", "118", {
    sourceName: "Revisión de prisión preventiva",
  }),
  item("control-de-acusacion", "Control de acusación", "167 a 169", { flags: ["no-verificado"] }),
  item("juicio-por-jurados", "Juicio por jurados", "197 y 198", {
    flags: ["validar"],
    hidden: true,
  }),
  item("custom-audiencia-de-prueba", "Audiencia de prueba anticipada (estudio)", null, {
    sourceName: null,
    origin: "FIRM",
  }),
]);

export const SETTINGS_STAGES = view("stages", { hideable: false, extensible: false }, [
  item("investigacion-preparatoria", "Investigación preparatoria", "133 a 158"),
  item("etapa-intermedia", "Etapa intermedia o control de acusación", "164 a 173"),
  item("juicio", "Juicio", "34, 35 y 181 a 212"),
]);

export const SETTINGS_COERCIVE_MEASURES = view(
  "coercive-measures",
  { hideable: true, extensible: false },
  [
    item("prision-preventiva", "Prisión preventiva", "114 a 119"),
    item("detencion-domiciliaria", "Detención domiciliaria", "113 inc. 1"),
  ],
);

export const SETTINGS_CATALOGS: CatalogView[] = [
  SETTINGS_STAGES,
  SETTINGS_HEARING_TYPES,
  SETTINGS_COERCIVE_MEASURES,
];

const fieldId = (n: number) => `00000000-0000-4000-e000-${String(n).padStart(12, "0")}`;

export const FIELD_FAMILY_COURT: CustomField = {
  id: fieldId(1),
  entity: "CASE_FILE",
  key: "juzgado-de-familia",
  label: "Juzgado de familia vinculado",
  type: "TEXT",
  required: false,
  position: 0,
  options: [],
  archived: false,
  createdAt: "2026-10-01T13:00:00Z",
};

export const FIELD_ORIGIN: CustomField = {
  id: fieldId(2),
  entity: "CASE_FILE",
  key: "origen-del-cliente",
  label: "Cómo llegó el cliente",
  type: "LIST",
  required: true,
  position: 1,
  options: [
    { code: "recomendacion", label: "Recomendación", hidden: false },
    { code: "defensoria", label: "Derivado por la defensoría", hidden: false },
    { code: "web", label: "Sitio web", hidden: true },
  ],
  archived: false,
  createdAt: "2026-10-02T13:00:00Z",
};

export const FIELD_OLD_FILE: CustomField = {
  id: fieldId(3),
  entity: "CASE_FILE",
  key: "numero-de-bibliorato",
  label: "Número de bibliorato",
  type: "NUMBER",
  required: false,
  position: 2,
  options: [],
  archived: true,
  createdAt: "2026-09-01T13:00:00Z",
};

export const CASE_FIELDS: CustomField[] = [FIELD_FAMILY_COURT, FIELD_ORIGIN, FIELD_OLD_FILE];

export const FIELD_INTERPRETER: CustomField = {
  id: fieldId(4),
  entity: "DEFENDANT",
  key: "necesita-interprete",
  label: "Necesita intérprete",
  type: "BOOLEAN",
  required: false,
  position: 0,
  options: [],
  archived: false,
  createdAt: "2026-10-03T13:00:00Z",
};

export const DEFENDANT_FIELDS: CustomField[] = [FIELD_INTERPRETER];

const rule = (
  overrides: Partial<DeadlineRule> & Pick<DeadlineRule, "code" | "name" | "article">,
): DeadlineRule => ({
  source: `Art. ${overrides.article} · ${LAW}`,
  trigger: "Detención",
  kind: "LEGAL",
  computation: "HOURS",
  duration: 24,
  scope: "DEFENDANT",
  detainee: true,
  consequence: "Libertad",
  caseLaw: { status: "Vigente", url: null, reviewedOn: "2026-11-21" },
  extensions: [],
  suspendedBy: [],
  flags: [],
  note: null,
  enabled: true,
  alertDaysBefore: 0,
  defaultAlertDaysBefore: 0,
  disclaimer: DISCLAIMER,
  ...overrides,
});

export const RULE_CONTROL = rule({
  code: "control-judicial-detencion",
  name: "Detención sin control judicial",
  article: "112; 49 inc. 5",
  flags: ["validar"],
  note: "Validar si se aprobó la ampliación a 48 h para narcomenudeo.",
});

export const RULE_REVIEW = rule({
  code: "revision-prision-preventiva",
  name: "Audiencia de revisión de prisión preventiva",
  article: "118",
  trigger: "Pedido de la defensa",
  computation: "CALENDAR_DAYS",
  duration: 5,
  consequence: "Pronto despacho y, a las 24 h, libertad (art. 120)",
  alertDaysBefore: 2,
  defaultAlertDaysBefore: 2,
  flags: ["validar"],
});

export const RULE_INVESTIGATION = rule({
  code: "investigacion-preparatoria",
  name: "Duración de la investigación preparatoria",
  article: "158; 160 inc. 7",
  trigger: "Apertura de la investigación o formulación de cargos (validar desde cuándo)",
  computation: "MONTHS",
  duration: 4,
  detainee: false,
  consequence: "Extinción de la acción y sobreseimiento",
  caseLaw: {
    status:
      "TSJ «Olave» (07/09/2024) declaró inconstitucional la consecuencia (arts. 158 y 160 inc. 7); el plazo sigue vigente.",
    url: "https://www.rionegro.com.ar/justicia/el-tsj-de-neuquen-demolio-otro-plazo-para-las-investigaciones-penales-3780038/",
    reviewedOn: "2026-11-21",
  },
  extensions: [
    { grantedBy: "Juez de garantías", maxAmount: 4 },
    { grantedBy: "Colegio de Jueces", maxAmount: 4 },
  ],
  suspendedBy: ["REBELLION", "MEDIATION"],
  alertDaysBefore: 15,
  defaultAlertDaysBefore: 15,
  flags: ["validar", "no-verificado"],
});

export const RULE_MEDIATION = rule({
  code: "mediacion-penal",
  name: "Mediación penal",
  article: "108",
  trigger: "Derivación a mediación",
  computation: "BUSINESS_DAYS",
  duration: 60,
  detainee: false,
  consequence: "Se retoma el proceso",
  enabled: false,
  alertDaysBefore: 5,
  defaultAlertDaysBefore: 5,
});

export const DEADLINE_RULES: DeadlineRule[] = [
  RULE_CONTROL,
  RULE_REVIEW,
  RULE_INVESTIGATION,
  RULE_MEDIATION,
];
