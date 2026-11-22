package ar.gestorpenal.dataimport;

/** A commit was asked for but some rows failed, so nothing was saved (answered as 422 with the report). */
class ImportHasErrorsException extends RuntimeException {

    private final transient ImportReport report;

    ImportHasErrorsException(ImportReport report) {
        super("The import has " + report.errorRows() + " row(s) with errors; nothing was saved");
        this.report = report;
    }

    ImportReport report() {
        return report;
    }
}
