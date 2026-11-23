import { describe, expect, it } from "vitest";

import {
  catalogOf,
  entityOf,
  parseCatalogSearch,
  parseFieldSearch,
} from "@/features/settings/settings-search";

describe("settings search", () => {
  it("keeps a known catalog and leaves the default out", () => {
    expect(parseCatalogSearch({ catalogo: "stages" })).toEqual({ catalogo: "stages" });
    expect(parseCatalogSearch({ catalogo: "hearing-types" })).toEqual({ catalogo: undefined });
    expect(parseCatalogSearch({ catalogo: "made-up" })).toEqual({ catalogo: undefined });
    expect(catalogOf({})).toBe("hearing-types");
  });

  it("reads whose fields to show", () => {
    expect(entityOf(parseFieldSearch({ para: "imputados" }))).toBe("DEFENDANT");
    expect(entityOf(parseFieldSearch({ para: "otra-cosa" }))).toBe("CASE_FILE");
    expect(entityOf(parseFieldSearch({}))).toBe("CASE_FILE");
  });
});
