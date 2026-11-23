/** What a file contains: the path segment of `/api/v1/imports/{kind}` (ADR-0019). */
export type ImportKind = "persons" | "cases" | "hearings";

/** A problem in one row. `column` is null when it is not about one column. */
export interface RowError {
  column: string | null;
  /** Spanish, and never repeats the cell's value. */
  message: string;
  /** Optional technical text for support; not shown to users. */
  detail: string | null;
}

export interface RowResult {
  /** The row number in the sheet: the header is row 1. */
  row: number;
  status: "VALID" | "ERROR";
  /** A short name of the record (a person, a case number); null when the row failed. */
  label: string | null;
  errors: RowError[];
}

/** Records created (committed) or that would be created (dry run), per type. */
export interface ImportCreated {
  persons: number;
  cases: number;
  defendants: number;
  hearings: number;
}

/** What an import did, or would do in a dry run (`ImportReport` in the backend). */
export interface ImportReport {
  kind: ImportKind;
  dryRun: boolean;
  committed: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  created: ImportCreated;
  rows: RowResult[];
}
