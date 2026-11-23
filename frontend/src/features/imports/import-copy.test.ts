import { describe, expect, it } from "vitest";

import { createdLabel, fileProblem, fileSizeLabel, nextKind } from "@/features/imports/import-copy";
import { importProblem, reportOfFailedCommit } from "@/features/imports/import-errors";
import { ApiError } from "@/lib/api";

const none = { persons: 0, cases: 0, defendants: 0, hearings: 0 };

describe("import copy", () => {
  it("says what is created in words, with singulars and a final «y»", () => {
    expect(createdLabel(none)).toBe("");
    expect(createdLabel({ ...none, persons: 1 })).toBe("1 persona");
    expect(createdLabel({ ...none, cases: 2, defendants: 1 })).toBe("2 causas y 1 imputado");
    expect(createdLabel({ ...none, cases: 1, defendants: 3, persons: 2 })).toBe(
      "1 causa, 3 imputados y 2 personas",
    );
  });

  it("reads file sizes the way people do", () => {
    expect(fileSizeLabel(200)).toBe("1 KB");
    expect(fileSizeLabel(250 * 1024)).toBe("250 KB");
    expect(fileSizeLabel(1.25 * 1024 * 1024)).toBe("1,3 MB");
  });

  it("accepts .csv and .xlsx up to 2 MB, in any letter case", () => {
    expect(fileProblem(new File(["x"], "Personas.XLSX"))).toBeNull();
    expect(fileProblem(new File(["x"], "personas.csv"))).toBeNull();
    expect(fileProblem(new File([], "personas.csv"))).toBe("El archivo está vacío.");
    expect(fileProblem(new File(["x"], "personas.ods"))).toMatch(/\.csv o \.xlsx/);
  });

  it("suggests the next kind in the recommended order", () => {
    expect(nextKind("persons")?.kind).toBe("cases");
    expect(nextKind("cases")?.kind).toBe("hearings");
    expect(nextKind("hearings")).toBeUndefined();
  });
});

describe("import errors", () => {
  it("falls back to its own words when an invalid file has no detail", () => {
    const problem = importProblem(new ApiError({ status: 400, type: "import-invalid-file" }));
    expect(problem.message).toMatch(/encabezados de la plantilla/);
    expect(problem.headers).toEqual([]);
  });

  it("never shows the server's text for other errors", () => {
    const problem = importProblem(
      new ApiError({ status: 500, type: "internal", detail: "NullPointerException" }),
    );
    expect(problem.title).toBe("El servidor no respondió como esperábamos");
    expect(problem.message).not.toMatch(/NullPointer/);
  });

  it("reads the report of a failed commit only from import-has-errors", () => {
    const report = { totalRows: 1, rows: [] };
    expect(
      reportOfFailedCommit(
        new ApiError({ status: 422, type: "import-has-errors", problem: { report } }),
      ),
    ).toBe(report);
    expect(
      reportOfFailedCommit(
        new ApiError({
          status: 422,
          type: "import-has-errors",
          problem: { report: { totalRows: 1 } },
        }),
      ),
    ).toBeUndefined();
    expect(
      reportOfFailedCommit(
        new ApiError({ status: 409, type: "concurrent-change", problem: { report } }),
      ),
    ).toBeUndefined();
  });
});
