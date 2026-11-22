package ar.gestorpenal.person;

import java.util.regex.Pattern;

/** The identity documents a person can be registered with, and the shape of their normalized numbers. */
enum DocumentType {
    DNI("\\d{7,8}"),
    PASSPORT("[A-Z0-9]{1,30}"),
    CUIT("\\d{11}"),
    CUIL("\\d{11}"),
    OTHER("[A-Z0-9]{1,30}");

    private final Pattern normalizedShape;

    DocumentType(String normalizedShape) {
        this.normalizedShape = Pattern.compile(normalizedShape);
    }

    /** Whether a number that is already normalized has the shape of this document type. */
    boolean accepts(String normalizedNumber) {
        return normalizedShape.matcher(normalizedNumber).matches();
    }
}
