package ar.gestorpenal.dataimport;

/**
 * A problem found in one row. The message is Spanish and never repeats the cell's value (personal
 * data); {@code detail} is an optional technical text for support. {@code column} is {@code null}
 * when the problem is not about one column.
 */
public record RowError(String column, String message, String detail) {}
