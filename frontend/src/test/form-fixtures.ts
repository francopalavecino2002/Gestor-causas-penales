/*
 * Fictitious data for the create and edit forms (T35): the catalogs the forms read besides the
 * case ones, the firm's members and a few persons. Names and numbers are made up.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  AnyCatalogId,
  CatalogItem,
  CatalogView,
  ReviewFlag,
} from "../features/catalogs/catalog-types";
import type { PersonView } from "../features/persons/person-api";
import { LAWYER_HUGO, LAWYER_LUCIA, LAWYER_PAULA } from "./agenda-fixtures";

const item = (code: string, name: string, flags: ReviewFlag[] = []): CatalogItem => ({
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
  source: "CPP de Neuquén (Ley 2784)",
  flags: [],
  note: null,
  hideable: false,
  extensible: false,
  items,
});

export const FORM_CATALOGS: CatalogView[] = [
  catalog("circumscriptions", [
    item("confluencia", "I Circunscripción, Confluencia"),
    item("ii-comarca", "II Circunscripción (de la Comarca)", ["validar"]),
    { ...item("vi-vaca-muerta", "VI Circunscripción (Vaca Muerta)", ["validar"]), hidden: true },
  ]),
  catalog("hearing-statuses", [
    item("solicitada", "Solicitada"),
    item("programada", "Programada"),
    item("reprogramada", "Reprogramada"),
    item("efectiva", "Realizada (efectiva)"),
    item("reconvertida", "Reconvertida"),
    item("cuarto-intermedio", "Cuarto intermedio o continuación"),
    item("suspendida", "Suspendida por el juez"),
    item("cancelada", "Cancelada"),
  ]),
  catalog("cancellation-reasons", [
    item("pedido-de-la-defensa", "Pedido de la defensa"),
    item("pedido-del-fiscal", "Pedido del fiscal"),
  ]),
  catalog("closing-outcomes", [
    item("sobreseimiento", "Sobreseimiento"),
    item("archivo", "Archivo"),
  ]),
];

/** The firm's active members: the signed-in owner and two lawyers, plus a paralegal. */
// The shape of FirmMember (member-api.ts), written out: that module is not reachable from e2e.
export interface MemberFixture {
  id: string;
  displayName: string;
  role: "OWNER" | "LAWYER" | "PARALEGAL" | "ADMIN_STAFF";
}

export const MEMBERS: MemberFixture[] = [
  { id: LAWYER_HUGO.id, displayName: LAWYER_HUGO.name, role: "LAWYER" },
  { id: LAWYER_LUCIA.id, displayName: LAWYER_LUCIA.name, role: "OWNER" },
  { id: LAWYER_PAULA.id, displayName: LAWYER_PAULA.name, role: "LAWYER" },
  { id: "00000000-0000-4000-8000-000000000004", displayName: "Tomás Muestra", role: "PARALEGAL" },
];

export const PERSON_JULIAN: PersonView = {
  id: "00000000-0000-4000-8000-000000000801",
  kind: "HUMAN",
  displayName: "Ficticio, Julián",
  firstNames: "Julián",
  lastNames: "Ficticio",
  legalName: null,
  documentType: "DNI",
  documentNumber: "99000111",
  archived: false,
};

export const PERSONS: PersonView[] = [PERSON_JULIAN];
