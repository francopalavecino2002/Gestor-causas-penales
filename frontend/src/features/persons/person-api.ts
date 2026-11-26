// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import { apiFetch } from "../../lib/api";

/** Identity documents (backend `DocumentType`). */
export type DocumentType = "DNI" | "PASSPORT" | "CUIT" | "CUIL" | "OTHER";

export type PersonKind = "HUMAN" | "LEGAL";

/** A person as the pickers read it (the core of backend `PersonView`). */
export interface PersonView {
  id: string;
  kind: PersonKind;
  displayName: string;
  firstNames: string | null;
  lastNames: string | null;
  legalName: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  archived: boolean;
}

export interface PersonPage {
  items: PersonView[];
  page: number;
  size: number;
  total: number;
}

/** A natural person, as the defendant forms create one (backend `PersonData`). */
export interface NewHumanPerson {
  kind: "HUMAN";
  firstNames: string | null;
  lastNames: string;
  documentType: DocumentType | null;
  documentNumber: string | null;
}

/** Every field of backend `PersonView`, as the Personas screen shows it. */
export interface PersonRecord extends PersonView {
  aliases: string | null;
  /** yyyy-mm-dd; humans only. */
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

/**
 * What a person is in one case. A reserved case the user is not on the team of comes masked:
 * `reserved` with no id and no caption.
 */
export interface CaseRole {
  caseId: string | null;
  caption: string | null;
  roleCode: string;
  roleName: string;
  caseArchived: boolean;
  reserved: boolean;
}

/** A person of the list and of the detail (backend `PersonListItem`). */
export interface PersonListItem extends PersonRecord {
  clientId: string | null;
  caseRoles: CaseRole[];
}

export interface PersonListPage {
  items: PersonListItem[];
  page: number;
  size: number;
  total: number;
}

/** The editable fields of a person (backend `PersonData`); a full replace on edit. */
export interface PersonData {
  kind: PersonKind;
  firstNames: string | null;
  lastNames: string | null;
  legalName: string | null;
  aliases: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/** Someone of the firm with the document being checked (backend `DocumentMatch`). */
export interface DocumentMatch {
  personId: string;
  displayName: string;
  documentType: DocumentType | null;
  documentNumber: string | null;
  archived: boolean;
  client: boolean;
  caseRoles: CaseRole[];
}

export interface ConflictCheckResult {
  matches: DocumentMatch[];
  /** Always there; shown verbatim. */
  disclaimer: string;
}

/** The editable fields of a client (backend `ClientData`). */
export interface ClientData {
  intakeDate: string;
  referralSource: string | null;
  consentGivenOn: string | null;
  consentScope: string | null;
  consentDocumentRef: string | null;
}

export interface ContactView {
  id: string;
  fullName: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  mayBeTold: string;
  archived: boolean;
}

export interface ContactData {
  fullName: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  mayBeTold: string;
}

/** A client with the person, the active contacts and others sharing the document. */
export interface ClientView extends ClientData {
  id: string;
  person: PersonRecord;
  archived: boolean;
  createdAt: string;
  contacts: ContactView[];
  conflicts: DocumentMatch[];
}

/** How many matches the picker shows: enough to choose, short enough for a phone. */
export const PERSON_SEARCH_SIZE = 8;

/** Persons per page on the Personas screen. */
export const PERSON_PAGE_SIZE = 20;

/** By name, alias or document number (separators allowed); archived persons left out. */
export function searchPersons(q: string, signal?: AbortSignal): Promise<PersonPage> {
  const params = new URLSearchParams({ q, page: "0", size: String(PERSON_SEARCH_SIZE) });
  return apiFetch<PersonPage>(`/api/v1/persons?${params.toString()}`, { signal });
}

export function createPerson(person: NewHumanPerson | PersonData): Promise<PersonView> {
  return apiFetch<PersonView>("/api/v1/persons", { method: "POST", body: person });
}

export interface PersonListParams {
  q?: string;
  includeArchived: boolean;
  /** From 0, as the API counts. */
  page: number;
}

/** One page of the Personas screen, with each person's client record and case roles. */
export function fetchPersonList(
  params: PersonListParams,
  signal?: AbortSignal,
): Promise<PersonListPage> {
  const search = new URLSearchParams({
    includeArchived: String(params.includeArchived),
    page: String(params.page),
    size: String(PERSON_PAGE_SIZE),
  });
  if (params.q) search.set("q", params.q);
  return apiFetch<PersonListPage>(`/api/v1/persons?${search.toString()}`, { signal });
}

export function fetchPersonOverview(id: string, signal?: AbortSignal): Promise<PersonListItem> {
  return apiFetch<PersonListItem>(`/api/v1/persons/${id}/overview`, { signal });
}

export function updatePerson(id: string, data: PersonData): Promise<PersonRecord> {
  return apiFetch<PersonRecord>(`/api/v1/persons/${id}`, { method: "PUT", body: data });
}

export function setPersonArchived(id: string, archived: boolean): Promise<void> {
  return apiFetch(`/api/v1/persons/${id}/${archived ? "archive" : "restore"}`, { method: "POST" });
}

/** A POST, so the document number never lands in a URL or the browser history. */
export function checkConflict(documentNumber: string): Promise<ConflictCheckResult> {
  return apiFetch<ConflictCheckResult>("/api/v1/persons/conflict-check", {
    method: "POST",
    body: { documentNumber },
  });
}

export function makeClient(personId: string, data: ClientData): Promise<ClientView> {
  return apiFetch<ClientView>(`/api/v1/persons/${personId}/client`, { method: "POST", body: data });
}

export function fetchClient(id: string, signal?: AbortSignal): Promise<ClientView> {
  return apiFetch<ClientView>(`/api/v1/clients/${id}`, { signal });
}

export function updateClient(id: string, data: ClientData): Promise<ClientView> {
  return apiFetch<ClientView>(`/api/v1/clients/${id}`, { method: "PUT", body: data });
}

export function setClientArchived(id: string, archived: boolean): Promise<void> {
  return apiFetch(`/api/v1/clients/${id}/${archived ? "archive" : "restore"}`, { method: "POST" });
}

export function addContact(clientId: string, data: ContactData): Promise<ContactView> {
  return apiFetch<ContactView>(`/api/v1/clients/${clientId}/contacts`, {
    method: "POST",
    body: data,
  });
}

export function updateContact(
  clientId: string,
  contactId: string,
  data: ContactData,
): Promise<ContactView> {
  return apiFetch<ContactView>(`/api/v1/clients/${clientId}/contacts/${contactId}`, {
    method: "PUT",
    body: data,
  });
}

export function archiveContact(clientId: string, contactId: string): Promise<void> {
  return apiFetch(`/api/v1/clients/${clientId}/contacts/${contactId}/archive`, { method: "POST" });
}
