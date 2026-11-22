package ar.gestorpenal.dataimport;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * State of one import run: what the row importers remember between rows (the case created by an
 * earlier row, cached catalogs) and how many records were created, for the report.
 */
public final class ImportContext {

    /** The records an import can create. */
    public enum RecordType {
        PERSONS,
        CASES,
        DEFENDANTS,
        HEARINGS
    }

    private final Map<Class<?>, Object> state = new HashMap<>();
    private final Map<RecordType, Integer> created = new EnumMap<>(RecordType.class);
    private final Map<RecordType, Integer> createdInRow = new EnumMap<>(RecordType.class);

    /** The state object of {@code type}, created by {@code initial} the first time it is asked for. */
    public <T> T state(Class<T> type, Supplier<T> initial) {
        return type.cast(state.computeIfAbsent(type, key -> initial.get()));
    }

    /** Counts a record created by the current row; it reaches the report only if the row succeeds. */
    public void created(RecordType type) {
        createdInRow.merge(type, 1, Integer::sum);
    }

    /** The current row succeeded: its records count. */
    void rowSucceeded() {
        createdInRow.forEach((type, count) -> created.merge(type, count, Integer::sum));
        createdInRow.clear();
    }

    /** The current row failed: whatever it created before failing is not counted. */
    void rowFailed() {
        createdInRow.clear();
    }

    int createdCount(RecordType type) {
        return created.getOrDefault(type, 0);
    }
}
