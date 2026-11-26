import { describe, expect, it } from "vitest";

import {
  canArchivePeople,
  distinctCases,
  documentLabel,
  isMaskedRole,
  sortCaseRoles,
} from "@/features/persons/person-format";
import { looksLikeDocument, parsePersonListSearch } from "@/features/persons/person-search";
import { PERSON_JULIAN } from "@/test/person-fixtures";

describe("person format", () => {
  it("writes a document with its type, or nothing", () => {
    expect(documentLabel("PASSPORT", "AB123")).toBe("Pasaporte AB123");
    expect(documentLabel(null, "123")).toBeNull();
  });

  it("puts the masked reserved cases last and counts cases, not roles", () => {
    const sorted = sortCaseRoles(PERSON_JULIAN.caseRoles);
    expect(isMaskedRole(sorted.at(-1)!)).toBe(true);
    expect(sorted.slice(0, -1).every((role) => !isMaskedRole(role))).toBe(true);
    const twice = [
      ...PERSON_JULIAN.caseRoles,
      { ...PERSON_JULIAN.caseRoles[0]!, roleName: "Testigo" },
    ];
    expect(distinctCases(twice)).toBe(4);
  });

  it("lets only the owner and the lawyers archive", () => {
    expect(canArchivePeople({ role: "OWNER" })).toBe(true);
    expect(canArchivePeople({ role: "LAWYER" })).toBe(true);
    expect(canArchivePeople({ role: "PARALEGAL" })).toBe(false);
    expect(canArchivePeople(null)).toBe(false);
  });

  it("keeps only valid list values from the URL", () => {
    expect(
      parsePersonListSearch({ q: " Ficticio ", pagina: "2", archivadas: "si", fuero: "civil" }),
    ).toEqual({
      q: "Ficticio",
      pagina: 2,
      archivadas: "si",
    });
    // A document number never stays in the URL, even as a bare number.
    expect(parsePersonListSearch({ q: 99000111, pagina: "0", archivadas: "no" })).toEqual({
      q: undefined,
      pagina: undefined,
      archivadas: undefined,
    });
  });

  it("tells a document number from a name", () => {
    for (const text of ["99000111", "99.000.111", "20-99000111-5", "30 99000333 1", "AB123456"]) {
      expect(looksLikeDocument(text)).toBe(true);
    }
    for (const text of ["Ficticio", "Ficticio 99", "12345", "Ruta 22 km 1234", ""]) {
      expect(looksLikeDocument(text)).toBe(false);
    }
  });
});
