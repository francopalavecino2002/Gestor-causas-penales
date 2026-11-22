package ar.gestorpenal.deadline;

final class Text {

    private Text() {}

    /** Trims the value; blank becomes {@code null}. */
    static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
