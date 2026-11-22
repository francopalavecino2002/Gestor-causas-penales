package ar.gestorpenal.dataimport;

import java.util.List;

/**
 * The cells of a file as text, before any meaning is given to them: the header row as written and
 * the data rows that are not blank. {@code number} is the row in the sheet, the header being row 1.
 */
record ParsedTable(List<String> headers, List<Row> rows) {

    record Row(int number, List<String> cells) {}
}
