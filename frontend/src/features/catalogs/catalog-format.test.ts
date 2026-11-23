import { describe, expect, it } from "vitest";

import { catalogOptionLabel } from "@/features/catalogs/catalog-format";
import type { CatalogItem } from "@/features/catalogs/catalog-types";

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  code: "x",
  name: "Control de acusación",
  sourceName: null,
  article: null,
  flags: [],
  note: null,
  origin: "JURISDICTION",
  hidden: false,
  ...overrides,
});

describe("catalogOptionLabel", () => {
  it("adds the CPP article and keeps the review tags visible", () => {
    expect(catalogOptionLabel(item({ article: "167 a 169" }))).toBe(
      "Control de acusación (CPP arts. 167 a 169)",
    );
    expect(catalogOptionLabel(item({ name: "II Circunscripción", flags: ["validar"] }))).toBe(
      "II Circunscripción [validar]",
    );
    expect(
      catalogOptionLabel(item({ article: "242", flags: ["no-verificado"] }), { article: false }),
    ).toBe("Control de acusación [no verificado]");
  });
});
