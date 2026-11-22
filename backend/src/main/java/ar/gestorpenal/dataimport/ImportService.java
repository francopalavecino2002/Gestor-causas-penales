package ar.gestorpenal.dataimport;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reads a file and runs its rows through the regular services in one transaction (ADR-0019). The same
 * code path serves the preview and the commit: a dry run, and a commit with any failed row, roll back.
 * Nothing of the file is stored. Row importers must translate the expected failures of their services
 * into {@link RowException}s; anything else aborts the import.
 */
@Service
class ImportService {

    static final int MAX_FILE_BYTES = 2 * 1024 * 1024;

    private static final int TRANSACTION_TIMEOUT_SECONDS = 120;
    private static final int MAX_SHOWN_HEADERS = 20;
    private static final int MAX_SHOWN_LENGTH = 60;

    private final Map<ImportKind, RowImporter> importers = new EnumMap<>(ImportKind.class);
    private final TransactionTemplate transaction;

    ImportService(List<RowImporter> rowImporters, PlatformTransactionManager transactionManager) {
        rowImporters.forEach(importer -> importers.put(importer.kind(), importer));
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setTimeout(TRANSACTION_TIMEOUT_SECONDS);
    }

    byte[] template(ImportKind kind) {
        return ImportTemplate.of(importerOf(kind).columns());
    }

    /**
     * @param fileName name of the uploaded file; its extension ({@code .csv} or {@code .xlsx}) picks the reader
     * @throws ImportHasErrorsException on a commit with failed rows
     */
    ImportReport run(
            AuthenticatedUser user, ImportKind kind, String fileName, long size, InputStream content, boolean dryRun)
            throws IOException {
        requireCanImport(user);
        if (size > MAX_FILE_BYTES) {
            throw new InvalidImportFileException("El archivo pesa más de 2 MB.");
        }
        RowImporter importer = importerOf(kind);
        ParsedTable table = readerFor(fileName).read(content);
        List<String> headers = checkedHeaders(table.headers(), importer.columns());

        ImportReport report = transaction.execute(status -> {
            ImportReport result = runRows(user, importer, headers, table.rows(), dryRun);
            if (!result.committed()) {
                status.setRollbackOnly();
            }
            return result;
        });
        if (!dryRun && !report.committed()) {
            throw new ImportHasErrorsException(report);
        }
        return report;
    }

    private ImportReport runRows(
            AuthenticatedUser user, RowImporter importer, List<String> headers, List<ParsedTable.Row> rows, boolean dryRun) {
        ImportContext context = new ImportContext();
        List<ImportReport.RowResult> results = new ArrayList<>();
        for (ParsedTable.Row row : rows) {
            ImportRow importRow = ImportRow.of(row.number(), cellsByHeader(headers, row.cells()));
            try {
                results.add(ImportReport.RowResult.valid(row.number(), importer.importRow(user, importRow, context)));
                context.rowSucceeded();
            } catch (RowException e) {
                context.rowFailed();
                results.add(ImportReport.RowResult.failed(row.number(), e.errors()));
            }
        }
        int errorRows = (int) results.stream().filter(result -> result.status() == ImportReport.Status.ERROR).count();
        return new ImportReport(
                importer.kind(),
                dryRun,
                !dryRun && errorRows == 0,
                results.size(),
                results.size() - errorRows,
                errorRows,
                ImportReport.Created.of(context),
                results);
    }

    private static void requireCanImport(AuthenticatedUser user) {
        if (user.role() != Role.OWNER && user.role() != Role.LAWYER) {
            throw new AccessDeniedException("Only the owner and lawyers can import data");
        }
    }

    private RowImporter importerOf(ImportKind kind) {
        RowImporter importer = importers.get(kind);
        if (importer == null) {
            throw new IllegalStateException("No importer registered for " + kind);
        }
        return importer;
    }

    private static TableReader readerFor(String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        if (name.endsWith(".csv")) {
            return new CsvTableReader();
        }
        if (name.endsWith(".xlsx")) {
            return new XlsxTableReader();
        }
        throw new InvalidImportFileException("El archivo tiene que ser .csv o .xlsx.");
    }

    /**
     * The normalized header of every column, in file order ({@code ""} for an unnamed column, which is
     * ignored). Unknown, repeated or missing required headers reject the file, so a typo never drops
     * a column silently.
     */
    private static List<String> checkedHeaders(List<String> raw, List<ImportColumn> columns) {
        List<String> headers = raw.stream().map(ImportText::header).toList();
        Set<String> known = new HashSet<>(columns.stream().map(ImportColumn::name).toList());
        Set<String> seen = new HashSet<>();
        List<String> unknown = new ArrayList<>();
        List<String> repeated = new ArrayList<>();
        for (String header : headers) {
            if (header.isEmpty()) {
                continue;
            }
            if (!known.contains(header)) {
                unknown.add(header);
            } else if (!seen.add(header)) {
                repeated.add(header);
            }
        }
        List<String> missing = columns.stream()
                .filter(ImportColumn::required)
                .map(ImportColumn::name)
                .filter(name -> !seen.contains(name))
                .toList();
        if (!unknown.isEmpty() || !repeated.isEmpty() || !missing.isEmpty()) {
            List<String> offending = new ArrayList<>(unknown);
            offending.addAll(repeated);
            offending.addAll(missing);
            throw new InvalidImportFileException(
                    headerMessage(shown(unknown), shown(repeated), shown(missing)), shown(offending));
        }
        return headers;
    }

    /** At most {@value #MAX_SHOWN_HEADERS} names of at most {@value #MAX_SHOWN_LENGTH} characters, so the answer stays small. */
    private static List<String> shown(List<String> names) {
        return names.stream()
                .limit(MAX_SHOWN_HEADERS)
                .map(name -> name.length() > MAX_SHOWN_LENGTH ? name.substring(0, MAX_SHOWN_LENGTH) : name)
                .toList();
    }

    private static String headerMessage(List<String> unknown, List<String> repeated, List<String> missing) {
        List<String> parts = new ArrayList<>();
        if (!unknown.isEmpty()) {
            parts.add("columnas desconocidas: " + String.join(", ", unknown));
        }
        if (!repeated.isEmpty()) {
            parts.add("columnas repetidas: " + String.join(", ", repeated));
        }
        if (!missing.isEmpty()) {
            parts.add("faltan columnas: " + String.join(", ", missing));
        }
        return "Los encabezados no coinciden con la plantilla (" + String.join("; ", parts) + ").";
    }

    private static Map<String, String> cellsByHeader(List<String> headers, List<String> cells) {
        Map<String, String> byHeader = new LinkedHashMap<>();
        for (int index = 0; index < headers.size() && index < cells.size(); index++) {
            if (!headers.get(index).isEmpty()) {
                byHeader.put(headers.get(index), cells.get(index));
            }
        }
        return byHeader;
    }
}
