// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import { apiFetch } from "../../lib/api";

/** Identity documents (backend `DocumentType`). */
export type DocumentType = "DNI" | "PASSPORT" | "CUIT" | "CUIL" | "OTHER";

/** A person as the API shows it (backend `PersonView`). */
export interface PersonView {
  id: string;
  kind: "HUMAN" | "LEGAL";
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

/** How many matches the picker shows: enough to choose, short enough for a phone. */
export const PERSON_SEARCH_SIZE = 8;

/** By name, alias or document number (separators allowed); archived persons left out. */
export function searchPersons(q: string, signal?: AbortSignal): Promise<PersonPage> {
  const params = new URLSearchParams({ q, page: "0", size: String(PERSON_SEARCH_SIZE) });
  return apiFetch<PersonPage>(`/api/v1/persons?${params.toString()}`, { signal });
}

export function createPerson(person: NewHumanPerson): Promise<PersonView> {
  return apiFetch<PersonView>("/api/v1/persons", { method: "POST", body: person });
}
