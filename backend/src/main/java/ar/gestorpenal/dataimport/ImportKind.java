package ar.gestorpenal.dataimport;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Optional;

/** What a file contains: one kind per endpoint, named by its path segment. */
public enum ImportKind {
    PERSONS("persons"),
    CASES("cases"),
    HEARINGS("hearings");

    private final String path;

    ImportKind(String path) {
        this.path = path;
    }

    @JsonValue
    public String path() {
        return path;
    }

    static Optional<ImportKind> fromPath(String path) {
        return Arrays.stream(values()).filter(kind -> kind.path.equals(path)).findFirst();
    }
}
