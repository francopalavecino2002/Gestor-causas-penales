import type { ImportKind, ImportReport } from "@/features/imports/import-types";
import { apiFetch } from "@/lib/api";

/** The CSV template of a kind: headers and one fictitious example row (a plain GET download). */
export function templateUrl(kind: ImportKind): string {
  return `/api/v1/imports/${kind}/template`;
}

/**
 * Sends the file. With `dryRun` the server runs every row and rolls back: nothing is saved. Without
 * it the import commits, or answers `422 import-has-errors` with the report and saves nothing.
 */
export function uploadImport(kind: ImportKind, file: File, dryRun: boolean): Promise<ImportReport> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<ImportReport>(`/api/v1/imports/${kind}?dryRun=${dryRun}`, {
    method: "POST",
    formData: form,
  });
}
