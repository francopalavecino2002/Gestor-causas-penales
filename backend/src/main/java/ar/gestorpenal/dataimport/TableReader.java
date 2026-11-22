package ar.gestorpenal.dataimport;

import java.io.IOException;
import java.io.InputStream;

/** Reads one file format into a {@link ParsedTable}. Fails with {@link InvalidImportFileException}. */
interface TableReader {

    /** Rows beyond this many (blank ones excluded) reject the file, so a bad file cannot hold a transaction for long. */
    int MAX_DATA_ROWS = 1000;

    ParsedTable read(InputStream content) throws IOException;

    /** A header row wider than this rejects the file. */
    int MAX_COLUMNS = 100;

    static void requireColumnLimit(int columns) {
        if (columns > MAX_COLUMNS) {
            throw new InvalidImportFileException("El archivo tiene más de " + MAX_COLUMNS + " columnas.");
        }
    }

    static InvalidImportFileException tooManyRows() {
        return new InvalidImportFileException("El archivo tiene más de " + MAX_DATA_ROWS + " filas de datos.");
    }
}
