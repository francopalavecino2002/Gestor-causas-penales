package ar.gestorpenal.dataimport;

import java.util.List;

/** A row cannot be imported. It is recorded in the report and the import goes on with the next row. */
public class RowException extends RuntimeException {

    private final transient List<RowError> errors;

    public RowException(List<RowError> errors) {
        super("The row has " + errors.size() + " error(s)", null, false, false);
        this.errors = List.copyOf(errors);
    }

    public static RowException of(String column, String message, String detail) {
        return new RowException(List.of(new RowError(column, message, detail)));
    }

    public static RowException of(String column, String message) {
        return of(column, message, null);
    }

    public List<RowError> errors() {
        return errors;
    }
}
