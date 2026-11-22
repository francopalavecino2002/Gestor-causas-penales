package ar.gestorpenal.dataimport;

import ar.gestorpenal.security.AuthenticatedUser;
import java.util.List;

/**
 * Imports one kind of record, row by row, through the regular services of its feature (ADR-0019).
 * Each feature implements it with its package-private services; {@code dataimport} owns the file,
 * the transaction and the report.
 */
public interface RowImporter {

    ImportKind kind();

    /** The columns of the file, in the order of the template. */
    List<ImportColumn> columns();

    /**
     * Creates the records of one row.
     *
     * @return a short label for the report (a name or a case number)
     * @throws RowException when the row has a problem; every expected failure of the services must
     *     be translated into it, because any other exception aborts the whole import
     */
    String importRow(AuthenticatedUser user, ImportRow row, ImportContext context);
}
