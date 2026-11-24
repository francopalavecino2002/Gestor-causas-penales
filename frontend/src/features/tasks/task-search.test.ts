import { describe, expect, it } from "vitest";

import { parseTaskSearch } from "@/features/tasks/task-search";

const PAULA = "00000000-0000-4000-8000-000000000002";

describe("parseTaskSearch", () => {
  it("keeps a member id and the done switch", () => {
    expect(parseTaskSearch({ persona: PAULA, hechas: "si" })).toEqual({
      persona: PAULA,
      hechas: "si",
    });
  });

  it("drops a persona that is not a user id", () => {
    for (const persona of ["paula", "123", `${PAULA}x`, 42, null, ""]) {
      expect(parseTaskSearch({ persona })).toEqual({ persona: undefined, hechas: undefined });
    }
  });

  it("only turns the done switch on with «si»", () => {
    for (const hechas of ["no", "true", true, 1]) {
      expect(parseTaskSearch({ hechas }).hechas).toBeUndefined();
    }
  });
});
