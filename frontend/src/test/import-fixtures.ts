import type { ImportKind, ImportReport, RowResult } from "../features/imports/import-types";

/*
 * Fictitious import reports shared by Vitest and Playwright. Names and numbers are invented; the
 * error messages are the backend's own (PersonRowImporter, CaseRowImporter, HearingRowImporter).
 */

const NOTHING = { persons: 0, cases: 0, defendants: 0, hearings: 0 };

const valid = (row: number, label: string): RowResult => ({
  row,
  status: "VALID",
  label,
  errors: [],
});

const VALID_ROWS: Record<ImportKind, RowResult[]> = {
  persons: [
    valid(2, "Ejemplo, Juan"),
    valid(3, "Modelo, Ana"),
    valid(4, "Prueba, Carlos"),
    valid(5, "Ficticia, Marta"),
  ],
  cases: [valid(2, "MPFNQ 90001/2026"), valid(3, "MPFNQ 90001/2026"), valid(4, "MPFNQ 90002/2026")],
  hearings: [
    valid(2, "MPFNQ 90001/2026, 01/12/2026 09:30"),
    valid(3, "MPFNQ 90002/2026, 03/12/2026 11:00"),
  ],
};

const CREATED: Record<ImportKind, ImportReport["created"]> = {
  persons: { ...NOTHING, persons: 4 },
  cases: { ...NOTHING, cases: 2, defendants: 3, persons: 1 },
  hearings: { ...NOTHING, hearings: 2 },
};

const FAILED_ROWS: Record<ImportKind, RowResult[]> = {
  persons: [
    {
      row: 3,
      status: "ERROR",
      label: null,
      errors: [
        {
          column: "numero_documento",
          message: "El número no tiene el formato del tipo de documento.",
          detail: null,
        },
        { column: "apellidos", message: "Una persona humana necesita apellidos.", detail: null },
      ],
    },
    {
      row: 6,
      status: "ERROR",
      label: null,
      errors: [
        {
          column: "tipo_persona",
          message: "Una persona jurídica no tiene nombres, apellidos ni fecha de nacimiento.",
          detail: null,
        },
      ],
    },
  ],
  cases: [
    {
      row: 4,
      status: "ERROR",
      label: null,
      errors: [
        { column: "legajo_mpf", message: "Ya existe una causa con ese legajo.", detail: null },
      ],
    },
  ],
  hearings: [
    {
      row: 3,
      status: "ERROR",
      label: null,
      errors: [{ column: null, message: "No existe un caso con ese número.", detail: null }],
    },
  ],
};

/** The report of a clean file: every row would be (or was) imported. */
export function cleanReport(kind: ImportKind, dryRun = true): ImportReport {
  const rows = VALID_ROWS[kind];
  return {
    kind,
    dryRun,
    committed: !dryRun,
    totalRows: rows.length,
    validRows: rows.length,
    errorRows: 0,
    created: CREATED[kind],
    rows,
  };
}

/** The report of a file with row errors: nothing can be saved. */
export function reportWithErrors(kind: ImportKind, dryRun = true): ImportReport {
  const failed = FAILED_ROWS[kind];
  const passed = VALID_ROWS[kind].filter((row) => !failed.some((bad) => bad.row === row.row));
  const rows = [...passed, ...failed].sort((a, b) => a.row - b.row);
  return {
    kind,
    dryRun,
    committed: false,
    totalRows: rows.length,
    validRows: passed.length,
    errorRows: failed.length,
    created: kind === "persons" ? { ...NOTHING, persons: passed.length } : CREATED[kind],
    rows,
  };
}
