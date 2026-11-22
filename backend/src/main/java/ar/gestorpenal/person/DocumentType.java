package ar.gestorpenal.person;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** The identity documents a person can be registered with, and the shape of their normalized numbers. */
public enum DocumentType {
    DNI("\\d{7,8}"),
    PASSPORT("[A-Z0-9]{1,30}"),
    CUIT("\\d{11}"),
    CUIL("\\d{11}"),
    OTHER("[A-Z0-9]{1,30}");

    private static final Map<String, DocumentType> BY_WORD = byWord();

    private final Pattern normalizedShape;

    DocumentType(String normalizedShape) {
        this.normalizedShape = Pattern.compile(normalizedShape);
    }

    /** Whether a number that is already normalized has the shape of this document type. */
    boolean accepts(String normalizedNumber) {
        return normalizedShape.matcher(normalizedNumber).matches();
    }

    /** Whether a number as typed in a file (separators allowed) has the shape of this document type. */
    public boolean acceptsNumber(String typedNumber) {
        return accepts(DocumentLookup.normalize(typedNumber));
    }

    /** The types by the Spanish word an import file uses, folded (lowercase, no accents). */
    public static Map<String, DocumentType> words() {
        return BY_WORD;
    }

    private static Map<String, DocumentType> byWord() {
        Map<String, DocumentType> words = new LinkedHashMap<>();
        words.put("dni", DNI);
        words.put("pasaporte", PASSPORT);
        words.put("cuit", CUIT);
        words.put("cuil", CUIL);
        words.put("otro", OTHER);
        return Collections.unmodifiableMap(words);
    }
}
