package ar.gestorpenal.deadline;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * The window of dates a deadline accepts. Anything outside it is a typing mistake, and rejecting it
 * keeps every computation small and away from the limits of {@link LocalDate} and PostgreSQL.
 */
final class SupportedDates {

    static final LocalDate FIRST = LocalDate.of(1990, 1, 1);
    static final LocalDate LAST = LocalDate.of(2100, 12, 31);

    private SupportedDates() {}

    /** {@code day} may be {@code null} (an optional field). */
    static void require(String what, LocalDate day) {
        if (day != null && (day.isBefore(FIRST) || day.isAfter(LAST))) {
            throw new InvalidDeadlineDataException(what + " must be between " + FIRST + " and " + LAST);
        }
    }

    static void require(String what, Instant instant) {
        if (instant != null
                && (instant.isBefore(FIRST.atStartOfDay(ZoneOffset.UTC).toInstant())
                        || !instant.isBefore(LAST.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()))) {
            throw new InvalidDeadlineDataException(what + " must be between " + FIRST + " and " + LAST);
        }
    }
}
