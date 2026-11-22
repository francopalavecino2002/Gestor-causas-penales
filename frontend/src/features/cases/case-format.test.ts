import { describe, expect, it } from "vitest";

import {
  countDetainees,
  custodialMismatch,
  defenceCounsel,
  formatNumericDate,
  formatShortDateTime,
  groupCaseHearings,
  libertySituation,
} from "@/features/cases/case-format";
import { isCaseId, MAX_PAGE, parseCaseListSearch } from "@/features/cases/case-search";
import type { CaseHearing } from "@/features/cases/case-types";
import { FIXTURE_NOW } from "@/test/agenda-fixtures";
import {
  CASE_MODELO,
  DEFENDANT_CARLA,
  DEFENDANT_NORA,
  HEARINGS_BY_CASE,
  MEASURES,
} from "@/test/case-fixtures";

const TODAY = "2026-11-23";
const preventive = MEASURES[DEFENDANT_CARLA.id] ?? [];
const [base] = preventive;
if (!base) throw new Error("Fixture without coercive measures");
const measure = (code: string, overrides: { active?: boolean; startsOn?: string } = {}) => ({
  ...base,
  measureCode: code,
  ...overrides,
});

describe("libertySituation", () => {
  it("puts custodial measures first, then rebellion, then any other measure in force", () => {
    expect(libertySituation(DEFENDANT_CARLA, preventive, TODAY)).toBe("prision-preventiva");
    expect(libertySituation(DEFENDANT_NORA, [], TODAY)).toBe("profugo-o-rebelde");
    // The backend counts a detainee by the measure, whatever else the record says.
    expect(libertySituation(DEFENDANT_NORA, preventive, TODAY)).toBe("prision-preventiva");
    expect(libertySituation(DEFENDANT_CARLA, [measure("detencion-domiciliaria")], TODAY)).toBe(
      "detencion-domiciliaria",
    );
    expect(libertySituation(DEFENDANT_CARLA, [measure("presentacion-periodica")], TODAY)).toBe(
      "en-libertad-con-medidas",
    );
    const lifted = { ...DEFENDANT_NORA, rebellionLiftedOn: "2026-09-01" };
    expect(libertySituation(lifted, [], TODAY)).toBe("en-libertad-sin-medidas");
  });

  it("counts only measures in force: not lifted or archived, and already started", () => {
    const lifted = measure("prision-preventiva", { active: false });
    expect(libertySituation(DEFENDANT_CARLA, [lifted], TODAY)).toBe("en-libertad-sin-medidas");
    const tomorrow = measure("prision-preventiva", { startsOn: "2026-11-24" });
    expect(libertySituation(DEFENDANT_CARLA, [tomorrow], TODAY)).toBe("en-libertad-sin-medidas");
    const startsToday = measure("prision-preventiva", { startsOn: TODAY });
    expect(libertySituation(DEFENDANT_CARLA, [startsToday], TODAY)).toBe("prision-preventiva");
  });

  it("flags a custodial measure still in force for a closed or suspended process", () => {
    for (const status of ["CLOSED", "SUSPENDED"] as const) {
      expect(custodialMismatch({ ...DEFENDANT_CARLA, status }, "prision-preventiva")).toBe(true);
    }
    expect(custodialMismatch(DEFENDANT_CARLA, "prision-preventiva")).toBe(false);
    expect(
      custodialMismatch({ ...DEFENDANT_CARLA, status: "CLOSED" }, "en-libertad-con-medidas"),
    ).toBe(false);
  });
});

describe("groupCaseHearings", () => {
  const [review, past] = HEARINGS_BY_CASE[CASE_MODELO.id] ?? [];
  if (!review || !past) throw new Error("Fixture without hearings");
  const at = (startsAt: string, statusCode: string, id: string): CaseHearing => ({
    ...review,
    id,
    startsAt,
    statusCode,
  });

  it("keeps only pending future hearings as upcoming, as the backend's next hearing does", () => {
    const suspended = at("2026-11-30T12:00:00Z", "suspendida", "s");
    const cancelled = at("2026-11-27T12:00:00Z", "cancelada", "c");
    const recess = at("2026-11-25T12:00:00Z", "cuarto-intermedio", "r");
    const groups = groupCaseHearings(
      [suspended, cancelled, recess, review, past],
      new Date(FIXTURE_NOW),
    );

    expect(groups.upcoming.map((hearing) => hearing.id)).toEqual([review.id, "r"]);
    expect(groups.called.map((hearing) => hearing.id)).toEqual(["c", "s"]);
    expect(groups.past.map((hearing) => hearing.id)).toEqual([past.id]);
  });
});

describe("case formatting", () => {
  it("names the defence", () => {
    expect(defenceCounsel(DEFENDANT_CARLA)).toBe("El estudio");
    expect(defenceCounsel(DEFENDANT_NORA)).toBe("Defensa oficial: Defensoría Pública ficticia 2");
    expect(
      defenceCounsel({ ...DEFENDANT_NORA, defenceCounselKind: null, defenceCounselName: null }),
    ).toBe("Sin cargar");
  });

  it("writes dates the Argentine way, in the firm's zone", () => {
    expect(formatNumericDate("2026-05-12")).toBe("12/05/2026");
    // 02:30 UTC is still the 22nd in Neuquén.
    expect(formatShortDateTime("2026-11-23T02:30:00Z", "America/Argentina/Salta")).toBe(
      "22/11/2026, 23:30",
    );
    expect(countDetainees(1)).toBe("1 persona detenida");
    expect(countDetainees(3)).toBe("3 personas detenidas");
  });
});

describe("parseCaseListSearch", () => {
  it("keeps valid values and drops the rest", () => {
    expect(parseCaseListSearch({ q: "  robo ", pagina: "3", archivadas: "si" })).toEqual({
      q: "robo",
      pagina: 3,
      archivadas: "si",
    });
    expect(parseCaseListSearch({ q: "   ", pagina: "1", archivadas: "true" })).toEqual({
      q: undefined,
      pagina: undefined,
      archivadas: undefined,
    });
    expect(parseCaseListSearch({ pagina: "-2" }).pagina).toBeUndefined();
    expect(parseCaseListSearch({ pagina: "2.5" }).pagina).toBeUndefined();
  });

  it("accepts numbers, as the router parses `?q=123989` and `?pagina=2`", () => {
    expect(parseCaseListSearch({ q: 123989, pagina: 2 })).toEqual({
      q: "123989",
      pagina: 2,
      archivadas: undefined,
    });
  });

  it("rejects arrays, objects and absurd page numbers", () => {
    expect(parseCaseListSearch({ q: ["robo", "hurto"], pagina: [2] })).toEqual({
      q: undefined,
      pagina: undefined,
      archivadas: undefined,
    });
    expect(parseCaseListSearch({ q: { text: "robo" } }).q).toBeUndefined();
    expect(parseCaseListSearch({ pagina: MAX_PAGE }).pagina).toBe(MAX_PAGE);
    expect(parseCaseListSearch({ pagina: MAX_PAGE + 1 }).pagina).toBeUndefined();
    expect(parseCaseListSearch({ pagina: 1e21 }).pagina).toBeUndefined();
  });
});

describe("isCaseId", () => {
  it("accepts the backend's UUIDs only", () => {
    expect(isCaseId(CASE_MODELO.id)).toBe(true);
    expect(isCaseId(CASE_MODELO.id.toUpperCase())).toBe(true);
    expect(isCaseId("no-es-un-id")).toBe(false);
    expect(isCaseId(`${CASE_MODELO.id}x`)).toBe(false);
    expect(isCaseId("")).toBe(false);
  });
});
