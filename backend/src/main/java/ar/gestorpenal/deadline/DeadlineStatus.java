package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.DeadlineCalculator.Result;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

/** Where a deadline stands at a given instant (ADR-0017). */
enum DeadlineStatus {
    /** The act was done in time or the lawyer closed it: it no longer runs. */
    MET,
    /** An open suspension stopped the clock. */
    SUSPENDED,
    /** The court calendar does not cover the term: the lawyer must count it by hand. */
    NOT_CALCULABLE,
    /** The term already ended. */
    OVERDUE,
    /** It ends within the alert window (at least the next 24 hours). */
    DUE_SOON,
    RUNNING;

    /**
     * @param alertDaysBefore the firm's warning for the rule; a deadline is always due soon in its last
     *     24 hours, even with a warning of 0 days
     */
    static DeadlineStatus of(Result result, LocalDate metOn, Instant now, int alertDaysBefore) {
        if (metOn != null) {
            return MET;
        }
        return switch (result.outcome()) {
            case SUSPENDED -> SUSPENDED;
            case CALENDAR_NOT_LOADED -> NOT_CALCULABLE;
            case DUE -> {
                if (!now.isBefore(result.dueAt())) {
                    yield OVERDUE;
                }
                Duration window = Duration.ofDays(Math.max(1, alertDaysBefore));
                yield result.dueAt().isAfter(now.plus(window)) ? RUNNING : DUE_SOON;
            }
        };
    }
}
