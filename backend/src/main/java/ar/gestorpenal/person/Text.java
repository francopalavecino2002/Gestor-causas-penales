package ar.gestorpenal.person;

/** Small helpers to clean free text coming from forms. */
final class Text {

    private Text() {}

    /** Trimmed text, or {@code null} when it is missing or blank. */
    static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
