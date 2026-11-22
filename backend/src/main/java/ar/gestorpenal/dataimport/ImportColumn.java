package ar.gestorpenal.dataimport;

/**
 * A column of an import file.
 *
 * @param name accent-free lowercase header, as it must appear in the file
 * @param required the header must be present (a row may still leave the cell blank where the kind allows it)
 * @param example a fictitious value for the downloadable template
 */
public record ImportColumn(String name, boolean required, String example) {}
