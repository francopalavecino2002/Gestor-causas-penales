import { describe, expect, it } from "vitest";

import {
  formatDay,
  formatJusRange,
  formatPesos,
  formatPesosInput,
  formatRange,
  groupMinimums,
  jusSentence,
  parsePesos,
} from "@/features/fees/fee-format";
import { FEE_SCALE } from "@/test/fee-fixtures";

/** "$ " with the no-break space the sign keeps with the number. */
const nb = (text: string) => text.replace(/\$ /g, "$\u00a0");

describe("fee format", () => {
  it("writes pesos and days as in Argentina", () => {
    expect(formatPesos(94963.25)).toBe(nb("$ 94.963,25"));
    expect(formatPesos(1_500_000)).toBe(nb("$ 1.500.000,00"));
    expect(formatDay("2026-07-01")).toBe("01/07/2026");
    expect(jusSentence({ value: 94963.25, validFrom: "2026-07-01" })).toBe(
      nb("JUS de $ 94.963,25, vigente desde el 01/07/2026"),
    );
  });

  it("writes one amount when both ends are equal", () => {
    expect(formatRange(10, 10)).toBe(nb("$ 10,00"));
    expect(formatRange(10, null)).toBe(nb("$ 10,00"));
    expect(formatRange(10, 20)).toBe(nb("$ 10,00 a $ 20,00"));
    expect(formatJusRange(10, 10)).toBe("10 JUS");
    expect(formatJusRange(10, 12.5)).toBe("Entre 10 y 12,5 JUS");
  });

  it("reads pesos as a lawyer types them", () => {
    expect(parsePesos("1.500.000,50")).toBe(1_500_000.5);
    expect(parsePesos("1500000")).toBe(1_500_000);
    expect(parsePesos("$ 94.963,25")).toBe(94963.25);
    expect(parsePesos("0")).toBe(0);
    expect(parsePesos("1500.5")).toBeNull();
    expect(parsePesos("1,505")).toBeNull();
    expect(parsePesos("-3")).toBeNull();
    expect(parsePesos("")).toBeNull();
    expect(formatPesosInput("94963,2")).toBe("94.963,20");
    expect(formatPesosInput("abc")).toBe("abc");
  });

  it("groups the minimums of the firm's areas, then the general ones", () => {
    const penal = [{ code: "penal", name: "Penal" }];
    const groups = groupMinimums(FEE_SCALE.minimums, penal, "");
    expect(groups.map((group) => group.label)).toEqual(["Penal", "Para todos los fueros"]);
    expect(groups.flatMap((group) => group.minimums).some((m) => m.code === "divorcio")).toBe(
      false,
    );

    const both = [...penal, { code: "familia", name: "Familia" }];
    expect(groupMinimums(FEE_SCALE.minimums, both, "familia").map((group) => group.label)).toEqual(
      ["Familia", "Para todos los fueros"],
    );
  });
});
