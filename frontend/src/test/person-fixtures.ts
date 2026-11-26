/*
 * Fictitious persons, clients and authorized contacts of the demo firm (T60), shared by the
 * Vitest suite and the Playwright mock backend, plus a small stateful stand-in for
 * `/api/v1/persons` and `/api/v1/clients`. Names, documents and phones are made up: the
 * documents start with 99, a range no real DNI uses yet.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  CaseRole,
  ClientData,
  ClientView,
  ContactData,
  ContactView,
  DocumentMatch,
  PersonData,
  PersonListItem,
  PersonRecord,
} from "../features/persons/person-api";
import {
  CASE_ARCHIVED,
  CASE_EJEMPLAR,
  CASE_EJEMPLO,
  CASE_MODELO,
  CASE_MUESTRA,
} from "./case-fixtures";

export const CONFLICT_DISCLAIMER =
  "Alerta simple por número de documento: revisá las causas antes de aceptar el caso.";

const personId = (n: number) => `00000000-0000-4000-8000-${String(800 + n).padStart(12, "0")}`;
const clientId = (n: number) => `00000000-0000-4000-f100-${String(n).padStart(12, "0")}`;
const contactId = (n: number) => `00000000-0000-4000-f200-${String(n).padStart(12, "0")}`;

const role = (
  ref: { id: string; caption: string },
  roleName: string,
  extra: Partial<CaseRole> = {},
): CaseRole => ({
  caseId: ref.id,
  caption: ref.caption,
  roleCode: roleName.toLowerCase().replace(/[^a-z]+/g, "-"),
  roleName,
  caseArchived: false,
  reserved: false,
  ...extra,
});

/** A reserved case the signed-in user is not on the team of: masked by the backend. */
const MASKED_ROLE: CaseRole = {
  caseId: null,
  caption: null,
  roleCode: "testigo",
  roleName: "Testigo",
  caseArchived: false,
  reserved: true,
};

function person(
  n: number,
  overrides: Partial<PersonListItem> & Pick<PersonListItem, "displayName">,
): PersonListItem {
  return {
    id: personId(n),
    kind: "HUMAN",
    firstNames: null,
    lastNames: null,
    legalName: null,
    aliases: null,
    documentType: null,
    documentNumber: null,
    birthDate: null,
    nationality: null,
    phone: null,
    email: null,
    address: null,
    archived: false,
    createdAt: "2026-10-05T13:00:00Z",
    clientId: null,
    caseRoles: [],
    ...overrides,
  };
}

/** A client with two contacts, in three cases (one reserved he may not see) and one archived. */
export const PERSON_JULIAN = person(1, {
  displayName: "Ficticio, Julián",
  firstNames: "Julián",
  lastNames: "Ficticio",
  aliases: "El Juli",
  documentType: "DNI",
  documentNumber: "99000111",
  birthDate: "1991-04-12",
  nationality: "Argentina",
  phone: "299 555-0101",
  email: "julian.ficticio@example.com",
  address: "Calle Inventada 123, Neuquén (ficticia)",
  clientId: clientId(1),
  caseRoles: [
    role(CASE_EJEMPLO, "Imputado/a"),
    role(CASE_MODELO, "Testigo"),
    MASKED_ROLE,
    role(CASE_ARCHIVED, "Imputado/a", { caseArchived: true }),
  ],
});

/** Same DNI inside his CUIL: the conflict check matches him with Julián. */
export const PERSON_JULIAN_CUIL = person(2, {
  displayName: "Ficticio, Julián Andrés",
  firstNames: "Julián Andrés",
  lastNames: "Ficticio",
  documentType: "CUIL",
  documentNumber: "20990001115",
  caseRoles: [role(CASE_MUESTRA, "Víctima")],
});

/** A defendant of a reserved case the user is on the team of: it shows, with a link. */
export const PERSON_NORA = person(3, {
  displayName: "Ficticia, Nora",
  firstNames: "Nora",
  lastNames: "Ficticia",
  documentType: "DNI",
  documentNumber: "99000222",
  phone: "299 555-0103",
  caseRoles: [role(CASE_EJEMPLAR, "Imputado/a", { reserved: true })],
});

export const PERSON_COMPANY = person(4, {
  kind: "LEGAL",
  displayName: "Transportes Ejemplo S.A. (ficticia)",
  legalName: "Transportes Ejemplo S.A. (ficticia)",
  aliases: "TransEjemplo",
  documentType: "CUIT",
  documentNumber: "30990003331",
  email: "contacto@transportes-ejemplo.example.com",
  caseRoles: [role(CASE_EJEMPLO, "Querellante")],
});

export const PERSON_ARCHIVED = person(5, {
  displayName: "Muestra, Ramiro",
  firstNames: "Ramiro",
  lastNames: "Muestra",
  documentType: "DNI",
  documentNumber: "99000444",
  archived: true,
});

export const ALL_PERSONS: PersonListItem[] = [
  PERSON_JULIAN,
  PERSON_JULIAN_CUIL,
  PERSON_NORA,
  PERSON_COMPANY,
  PERSON_ARCHIVED,
];

export const CONTACT_LAURA: ContactView = {
  id: contactId(1),
  fullName: "Laura Ficticia",
  relationship: "Hermana",
  phone: "299 555-0102",
  email: null,
  mayBeTold: "Fechas y horarios de las audiencias, y si sigue en libertad.",
  archived: false,
};

export const CONTACT_MARTIN: ContactView = {
  id: contactId(2),
  fullName: "Martín Ejemplo",
  relationship: "Pareja",
  phone: null,
  email: "martin.ejemplo@example.com",
  mayBeTold: "Solo las fechas de las audiencias.",
  archived: false,
};

export const CLIENT_JULIAN: ClientView = {
  id: clientId(1),
  person: recordOf(PERSON_JULIAN),
  intakeDate: "2026-10-05",
  referralSource: "Derivado por otro cliente (ficticio)",
  consentGivenOn: "2026-10-05",
  consentScope: "Para su defensa en las causas del estudio y para avisarle las audiencias.",
  consentDocumentRef: "Carpeta 12, formulario firmado (ficticio)",
  archived: false,
  createdAt: "2026-10-05T13:10:00Z",
  contacts: [CONTACT_LAURA, CONTACT_MARTIN],
  conflicts: [],
};

export const ALL_CLIENTS: ClientView[] = [CLIENT_JULIAN];

/** The person's own fields, without the client id and the roles. */
export function recordOf(item: PersonListItem): PersonRecord {
  const record: Partial<PersonListItem> = { ...item };
  delete record.clientId;
  delete record.caseRoles;
  return record as PersonRecord;
}

/** Same as the backend's DocumentLookup.normalize. */
const normalize = (number: string) => number.replace(/[\s.-]/g, "").toUpperCase();

/** The DNI a number carries: itself (padded to 8), or digits 3 to 10 of a CUIT or CUIL. */
function dniOf(number: string): string | null {
  if (/^\d{7,8}$/.test(number)) return number.padStart(8, "0");
  if (/^\d{11}$/.test(number)) return number.slice(2, 10);
  return null;
}

function sameDocument(a: string, b: string): boolean {
  if (a === b) return true;
  const dniA = dniOf(a);
  return dniA !== null && dniA === dniOf(b);
}

function matchOf(item: PersonListItem, clients: ClientView[]): DocumentMatch {
  return {
    personId: item.id,
    displayName: item.displayName,
    documentType: item.documentType,
    documentNumber: item.documentNumber,
    archived: item.archived,
    client: clients.some((client) => client.person.id === item.id),
    caseRoles: item.caseRoles,
  };
}

function displayNameOf(data: PersonData): string {
  if (data.kind === "LEGAL") return data.legalName ?? "";
  return data.firstNames ? `${data.lastNames}, ${data.firstNames}` : (data.lastNames ?? "");
}

/** The query string, as plain strings. */
export type PersonQuery = Partial<Record<string, string | null>>;

export interface PersonAnswer {
  status: number;
  json?: unknown;
  /** A problem type, for error answers. */
  problem?: string;
  /** Extension members of the problem (e.g. `existingPersonId`). */
  members?: Record<string, unknown>;
}

const PERSON_PATH = /^\/api\/v1\/persons\/([0-9a-f-]+)(?:\/(overview|archive|restore|client))?$/;
const CLIENT_PATH =
  /^\/api\/v1\/clients\/([0-9a-f-]+)(?:\/(archive|restore|contacts)(?:\/([0-9a-f-]+)(?:\/(archive))?)?)?$/;

/**
 * A stateful `/api/v1/persons` and `/api/v1/clients` over a copy of the fixtures: what a test
 * saves shows up in the next GET. Archiving persons and clients answers 403 for roles other than
 * the owner and lawyers, like the real one. Undefined when the request is not one of its routes.
 */
export function personsBackend(
  initial: { persons?: PersonListItem[]; clients?: ClientView[] } = {},
  options: { role?: string } = {},
) {
  const persons: PersonListItem[] = structuredClone(initial.persons ?? ALL_PERSONS);
  const clients: ClientView[] = structuredClone(initial.clients ?? ALL_CLIENTS);
  const canArchive = ["OWNER", "LAWYER"].includes(options.role ?? "OWNER");
  let next = 900;

  const conflictsOf = (item: PersonListItem) =>
    item.documentNumber
      ? persons
          .filter(
            (other) =>
              other.id !== item.id &&
              other.documentNumber !== null &&
              sameDocument(other.documentNumber, item.documentNumber ?? ""),
          )
          .map((other) => matchOf(other, clients))
      : [];
  const clientJson = (client: ClientView): ClientView => {
    const owner = persons.find((candidate) => candidate.id === client.person.id);
    return {
      ...client,
      person: owner ? recordOf(owner) : client.person,
      contacts: client.contacts.filter((contact) => !contact.archived),
      conflicts: owner ? conflictsOf(owner) : [],
    };
  };
  const duplicateOf = (number: string | null, except?: string) =>
    number
      ? persons.find((candidate) => candidate.id !== except && candidate.documentNumber === number)
      : undefined;

  return (
    method: string,
    path: string,
    query: PersonQuery,
    body: () => unknown,
  ): PersonAnswer | undefined => {
    if (path === "/api/v1/persons" && method === "GET") {
      const q = (query.q ?? "").trim().toLowerCase();
      const number = normalize(q);
      const includeArchived = query.includeArchived === "true";
      const size = Math.min(Math.max(Number(query.size ?? 20), 1), 100);
      const page = Math.max(Number(query.page ?? 0), 0);
      const found = persons
        .filter((item) => includeArchived || !item.archived)
        .filter(
          (item) =>
            !q ||
            item.displayName.toLowerCase().includes(q) ||
            (item.aliases ?? "").toLowerCase().includes(q) ||
            (number !== "" && (item.documentNumber ?? "").includes(number)),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "es-AR"));
      return {
        status: 200,
        json: {
          items: found.slice(page * size, page * size + size),
          page,
          size,
          total: found.length,
        },
      };
    }
    if (path === "/api/v1/persons" && method === "POST") {
      const data = body() as PersonData;
      const existing = duplicateOf(data.documentNumber);
      if (existing) {
        return {
          status: 409,
          problem: "person-duplicate-document",
          members: { existingPersonId: existing.id },
        };
      }
      const created: PersonListItem = {
        ...person(next++, { displayName: displayNameOf(data) }),
        ...data,
        displayName: displayNameOf(data),
        createdAt: "2026-11-23T13:20:00Z",
      };
      persons.push(created);
      return { status: 201, json: recordOf(created) };
    }
    if (path === "/api/v1/persons/conflict-check" && method === "POST") {
      const number = normalize(
        String((body() as { documentNumber?: unknown }).documentNumber ?? ""),
      );
      if (!number) return { status: 400, problem: "invalid-person-data" };
      const matches = persons
        .filter((item) => item.documentNumber && sameDocument(item.documentNumber, number))
        .map((item) => matchOf(item, clients));
      return { status: 200, json: { matches, disclaimer: CONFLICT_DISCLAIMER } };
    }

    const personMatch = PERSON_PATH.exec(path);
    if (personMatch) {
      const target = persons.find((item) => item.id === personMatch[1]);
      if (!target) return { status: 404, problem: "not-found" };
      const action = personMatch[2];
      if (method === "GET" && action === "overview") return { status: 200, json: target };
      if (method === "GET" && !action) return { status: 200, json: recordOf(target) };
      if (method === "PUT" && !action) {
        const data = body() as PersonData;
        if (data.kind !== target.kind) {
          return { status: 400, problem: "invalid-person-data" };
        }
        const existing = duplicateOf(data.documentNumber, target.id);
        if (existing) {
          return {
            status: 409,
            problem: "person-duplicate-document",
            members: { existingPersonId: existing.id },
          };
        }
        Object.assign(target, data, { displayName: displayNameOf(data) });
        return { status: 200, json: recordOf(target) };
      }
      if (method === "POST" && (action === "archive" || action === "restore")) {
        if (!canArchive) return { status: 403, problem: "access-denied" };
        target.archived = action === "archive";
        return { status: 204 };
      }
      if (method === "POST" && action === "client") {
        if (target.clientId) {
          return {
            status: 409,
            problem: "already-a-client",
            members: { clientId: target.clientId },
          };
        }
        const data = body() as ClientData;
        const client: ClientView = {
          ...data,
          id: clientId(next++),
          person: recordOf(target),
          archived: false,
          createdAt: "2026-11-23T13:20:00Z",
          contacts: [],
          conflicts: [],
        };
        clients.push(client);
        target.clientId = client.id;
        return { status: 201, json: clientJson(client) };
      }
      return undefined;
    }

    const clientMatch = CLIENT_PATH.exec(path);
    if (clientMatch) {
      const client = clients.find((candidate) => candidate.id === clientMatch[1]);
      if (!client) return { status: 404, problem: "not-found" };
      const [, , action, contact, contactAction] = clientMatch;
      if (!action) {
        if (method === "GET") return { status: 200, json: clientJson(client) };
        if (method === "PUT") {
          Object.assign(client, body() as ClientData);
          return { status: 200, json: clientJson(client) };
        }
        return undefined;
      }
      if (method === "POST" && (action === "archive" || action === "restore")) {
        if (!canArchive) return { status: 403, problem: "access-denied" };
        client.archived = action === "archive";
        return { status: 204 };
      }
      if (action === "contacts" && !contact && method === "POST") {
        const data = body() as ContactData;
        const added: ContactView = { ...data, id: contactId(next++), archived: false };
        client.contacts.push(added);
        return { status: 201, json: added };
      }
      const existing = client.contacts.find((candidate) => candidate.id === contact);
      if (action === "contacts" && contact) {
        if (!existing) return { status: 404, problem: "not-found" };
        if (method === "PUT" && !contactAction) {
          Object.assign(existing, body() as ContactData);
          return { status: 200, json: existing };
        }
        if (method === "POST" && contactAction === "archive") {
          existing.archived = true;
          return { status: 204 };
        }
      }
      return undefined;
    }
    return undefined;
  };
}
