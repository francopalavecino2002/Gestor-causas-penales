package ar.gestorpenal.dataimport;

import java.util.List;

/**
 * What an import did, or would do in a dry run (ADR-0019).
 *
 * @param committed the records were saved; always {@code false} in a dry run and when a row failed
 * @param created records created (committed) or that would be created, per type
 * @param rows every data row, with the number it has in the sheet (the header is row 1)
 */
record ImportReport(
        ImportKind kind,
        boolean dryRun,
        boolean committed,
        int totalRows,
        int validRows,
        int errorRows,
        Created created,
        List<RowResult> rows) {

    public enum Status {
        VALID,
        ERROR
    }

    public record Created(int persons, int cases, int defendants, int hearings) {

        static Created of(ImportContext context) {
            return new Created(
                    context.createdCount(ImportContext.RecordType.PERSONS),
                    context.createdCount(ImportContext.RecordType.CASES),
                    context.createdCount(ImportContext.RecordType.DEFENDANTS),
                    context.createdCount(ImportContext.RecordType.HEARINGS));
        }
    }

    /** {@code label} is a short name of the record (a person, a case number); {@code null} when the row failed. */
    public record RowResult(int row, Status status, String label, List<RowError> errors) {

        static RowResult valid(int row, String label) {
            return new RowResult(row, Status.VALID, label, List.of());
        }

        static RowResult failed(int row, List<RowError> errors) {
            return new RowResult(row, Status.ERROR, null, errors);
        }
    }
}
