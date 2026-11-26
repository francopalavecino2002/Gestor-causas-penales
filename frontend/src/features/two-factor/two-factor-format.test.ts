import { describe, expect, it } from "vitest";

import { groupSecret, recoveryCodesFile } from "@/features/two-factor/two-factor-format";
import { demoRecoveryCodes } from "@/test/two-factor-fixtures";

describe("two-factor format", () => {
  it("groups the secret in blocks of four, ignoring spaces and case", () => {
    expect(groupSecret("gezd gnbv gy3t qojq ge")).toEqual(["GEZD", "GNBV", "GY3T", "QOJQ", "GE"]);
  });

  it("writes the codes file with the account, the date, how it works and the numbered list", () => {
    const codes = demoRecoveryCodes(1);
    const text = recoveryCodesFile(
      codes,
      { email: "lucia.ejemplo@example.com", firm: "Estudio Demo (ficticio)" },
      new Date("2026-11-23T13:20:00Z"),
    );
    const lines = text.split("\r\n");
    expect(lines[1]).toBe("Cuenta: lucia.ejemplo@example.com (Estudio Demo (ficticio))");
    expect(lines[2]).toBe("Generados el 23 de noviembre de 2026");
    expect(lines).toContain(`1. ${codes[0]}`);
    expect(lines).toContain(`10. ${codes[9]}`);
    expect(text).not.toMatch(/[^\r]\n/);
  });
});
