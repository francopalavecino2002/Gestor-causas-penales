package ar.gestorpenal.dataimport;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * One data row of the file: the cells by normalized header and the parsing helpers of the importers.
 * A cell that does not parse adds an error for its column and yields {@code null}, so an importer
 * can read every column and then call {@link #throwIfErrors()} to report all the problems at once.
 */
public final class ImportRow {

    private static final DateTimeFormatter DAY_MONTH_YEAR = DateTimeFormatter.ofPattern("d/M/uuuu")
            .withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("H:mm")
            .withResolverStyle(ResolverStyle.STRICT);

    private final int number;
    private final Map<String, String> cells;
    private final List<RowError> errors = new ArrayList<>();

    private ImportRow(int number, Map<String, String> cells) {
        this.number = number;
        this.cells = cells;
    }

    /** {@code number} is the row in the sheet: the header is row 1. */
    public static ImportRow of(int number, Map<String, String> cellsByHeader) {
        return new ImportRow(number, cellsByHeader);
    }

    public int number() {
        return number;
    }

    /** The cell trimmed, or {@code null} when it is blank or the column is not in the file. */
    public String text(String column) {
        String value = cells.get(column);
        return value == null || value.isBlank() ? null : value.strip();
    }

    /** Adds the "missing" error for {@code column} when {@code value} is {@code null}. */
    public <T> T require(String column, T value) {
        if (value == null && !hasErrorIn(column)) {
            error(column, "Falta este dato.");
        }
        return value;
    }

    /** {@code dd/mm/aaaa}, {@code d/m/aaaa} or {@code aaaa-mm-dd}. */
    public LocalDate date(String column) {
        String value = text(column);
        if (value == null) {
            return null;
        }
        try {
            return value.contains("/") ? LocalDate.parse(value, DAY_MONTH_YEAR) : LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            error(column, "Fecha inválida, usá dd/mm/aaaa.");
            return null;
        }
    }

    /** {@code hh:mm} or {@code h:mm}. */
    public LocalTime time(String column) {
        String value = text(column);
        if (value == null) {
            return null;
        }
        try {
            return LocalTime.parse(value, HOUR_MINUTE);
        } catch (DateTimeParseException e) {
            error(column, "Hora inválida, usá hh:mm.");
            return null;
        }
    }

    public Integer integer(String column) {
        String value = text(column);
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException e) {
            error(column, "Número entero inválido.");
            return null;
        }
    }

    /**
     * The value that goes with the word in the cell. Options are keyed by folded words (lowercase,
     * no accents, spaces or underscores as in {@code instancia_privada}); the cell is folded the same way.
     */
    public <T> T choice(String column, Map<String, T> options) {
        String value = text(column);
        if (value == null) {
            return null;
        }
        T found = options.get(ImportText.header(value));
        if (found == null) {
            error(column, "Valor no reconocido. Opciones: " + String.join(", ", options.keySet()) + ".");
        }
        return found;
    }

    /** The values of a multi-value cell, separated by {@code |} (the {@code ;} may be the CSV delimiter). */
    public List<String> list(String column) {
        String value = text(column);
        if (value == null) {
            return List.of();
        }
        return Arrays.stream(value.split("\\|")).map(String::strip).filter(item -> !item.isEmpty()).toList();
    }

    public void error(String column, String message) {
        error(column, message, null);
    }

    public void error(String column, String message, String detail) {
        errors.add(new RowError(column, message, detail));
    }

    /** Throws a {@link RowException} with every error collected so far, if there is any. */
    public void throwIfErrors() {
        if (!errors.isEmpty()) {
            throw new RowException(errors);
        }
    }

    private boolean hasErrorIn(String column) {
        return errors.stream().anyMatch(error -> column.equals(error.column()));
    }
}
