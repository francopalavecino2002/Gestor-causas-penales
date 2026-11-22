package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.CourtCalendar.CalendarNotLoadedException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Computes the due date of one deadline (ADR-0017). Pure: everything it needs comes in the
 * {@link Input}, so every computation type is unit-tested without a database.
 *
 * <ul>
 *   <li>Hours run continuously from the triggering instant (art. 79).
 *   <li>Day terms start counting the day after the trigger; business days skip weekends and the court
 *       calendar, calendar days (corridos) do not. Suspended days never count.
 *   <li>Month and year terms go date to date (a missing day is the month's last one); a judicial
 *       deadline starts from the date the lawyer loaded. Closed suspensions add the suspended calendar
 *       days to that date.
 *   <li>Day-based terms end at 24 h of the last day: {@code dueAt} is the start of the next day.
 *   <li>A suspension without an end that starts before the term ends leaves it suspended, without a
 *       due date: the clock is stopped.
 * </ul>
 */
final class DeadlineCalculator {

    private final CourtCalendar calendar;
    private final ZoneId zone;

    DeadlineCalculator(CourtCalendar calendar, ZoneId zone) {
        this.calendar = calendar;
        this.zone = zone;
    }

    /** A period that stops the clock, both days included; {@code to == null} means it has not ended. */
    record Suspension(LocalDate from, LocalDate to) {

        Suspension {
            Objects.requireNonNull(from);
            if (to != null && to.isBefore(from)) {
                throw new IllegalArgumentException("A suspension cannot end before it starts");
            }
        }

        boolean isOpen() {
            return to == null;
        }

        boolean covers(LocalDate day) {
            return !day.isBefore(from) && (to == null || !day.isAfter(to));
        }
    }

    /**
     * @param amount the rule's duration plus every granted extension, in the computation's unit
     * @param triggeredAt the triggering instant; required for {@link Computation#HOURS}
     * @param triggeredOn the triggering day in the firm's zone
     * @param setDueOn the date a judge or prosecutor set; only for {@link Computation#SET_BY_COURT}
     */
    record Input(
            Computation computation,
            int amount,
            Instant triggeredAt,
            LocalDate triggeredOn,
            LocalDate setDueOn,
            List<Suspension> suspensions) {

        Input {
            suspensions = suspensions == null ? List.of() : List.copyOf(suspensions);
        }
    }

    enum Outcome {
        DUE,
        /** An open suspension stopped the clock: there is no due date yet. */
        SUSPENDED,
        /** A business-day term reached a year the court calendar does not have. */
        CALENDAR_NOT_LOADED
    }

    /**
     * @param dueOn the last day of the term in the firm's zone
     * @param dueAt the instant the term ends
     * @param suspendedDays calendar days the suspensions added while the term was running
     * @param missingYear the year the court calendar lacks, for {@link Outcome#CALENDAR_NOT_LOADED}
     */
    record Result(Outcome outcome, LocalDate dueOn, Instant dueAt, int suspendedDays, Integer missingYear) {

        static Result due(LocalDate dueOn, Instant dueAt, int suspendedDays) {
            return new Result(Outcome.DUE, dueOn, dueAt, suspendedDays, null);
        }

        static Result suspended(int suspendedDays) {
            return new Result(Outcome.SUSPENDED, null, null, suspendedDays, null);
        }

        static Result calendarNotLoaded(int year) {
            return new Result(Outcome.CALENDAR_NOT_LOADED, null, null, 0, year);
        }
    }

    Result compute(Input input) {
        return switch (input.computation()) {
            case HOURS -> hours(input);
            case BUSINESS_DAYS, CALENDAR_DAYS -> days(input);
            case MONTHS -> fromBaseDate(input.triggeredOn().plusMonths(input.amount()), input);
            case YEARS -> fromBaseDate(input.triggeredOn().plusYears(input.amount()), input);
            case SET_BY_COURT -> fromBaseDate(Objects.requireNonNull(input.setDueOn()), input);
        };
    }

    /** Continuous hours: no calendar and no suspensions (the package loader rejects them for hours). */
    private Result hours(Input input) {
        Instant dueAt = Objects.requireNonNull(input.triggeredAt()).plus(Duration.ofHours(input.amount()));
        return Result.due(dueAt.atZone(zone).toLocalDate(), dueAt, 0);
    }

    private Result days(Input input) {
        boolean businessOnly = input.computation() == Computation.BUSINESS_DAYS;
        LocalDate day = input.triggeredOn();
        int counted = 0;
        int suspended = 0;
        try {
            while (counted < input.amount()) {
                day = day.plusDays(1);
                Suspension stopping = coveringSuspension(input.suspensions(), day);
                if (stopping != null) {
                    if (stopping.isOpen()) {
                        return Result.suspended(suspended);
                    }
                    suspended++;
                } else if (!businessOnly || calendar.isBusinessDay(day)) {
                    counted++;
                }
            }
        } catch (CalendarNotLoadedException e) {
            return Result.calendarNotLoaded(e.year());
        }
        return Result.due(day, endOf(day), suspended);
    }

    /**
     * Moves {@code base} forward by the suspended calendar days that fall inside the term, until the
     * term stops growing: a suspension that the longer term now reaches also counts.
     */
    private Result fromBaseDate(LocalDate base, Input input) {
        LocalDate due = base;
        while (true) {
            LocalDate end = due;
            boolean stopped = input.suspensions().stream()
                    .anyMatch(s -> s.isOpen() && !s.from().isAfter(end));
            int suspended = suspendedDaysBetween(input.suspensions(), input.triggeredOn(), end);
            if (stopped) {
                return Result.suspended(suspended);
            }
            LocalDate next = base.plusDays(suspended);
            if (next.equals(due)) {
                return Result.due(due, endOf(due), suspended);
            }
            due = next;
        }
    }

    /**
     * Days in {@code (after, until]} covered by at least one suspension (overlaps count once), by
     * interval arithmetic: the cost depends on the number of suspensions, not on the length of the term.
     */
    private static int suspendedDaysBetween(List<Suspension> suspensions, LocalDate after, LocalDate until) {
        LocalDate first = after.plusDays(1);
        List<Range> clipped = suspensions.stream()
                .map(s -> new Range(
                        s.from().isBefore(first) ? first : s.from(),
                        s.isOpen() || s.to().isAfter(until) ? until : s.to()))
                .filter(range -> !range.to().isBefore(range.from()))
                .sorted(Comparator.comparing(Range::from))
                .toList();
        long days = 0;
        LocalDate countedUntil = after;
        for (Range range : clipped) {
            LocalDate from = range.from().isAfter(countedUntil) ? range.from() : countedUntil.plusDays(1);
            if (!range.to().isBefore(from)) {
                days += ChronoUnit.DAYS.between(from, range.to()) + 1;
                countedUntil = range.to();
            }
        }
        return Math.toIntExact(days);
    }

    /** A suspension clipped to the term; may be empty ({@code to} before {@code from}). */
    private record Range(LocalDate from, LocalDate to) {}

    /** The suspension covering {@code day}, preferring an open one; {@code null} if none does. */
    private static Suspension coveringSuspension(List<Suspension> suspensions, LocalDate day) {
        Suspension found = null;
        for (Suspension suspension : suspensions) {
            if (suspension.covers(day)) {
                if (suspension.isOpen()) {
                    return suspension;
                }
                found = suspension;
            }
        }
        return found;
    }

    /** A term counted in days ends at 24 h of its last day (art. 79). */
    private Instant endOf(LocalDate day) {
        return day.plusDays(1).atStartOfDay(zone).toInstant();
    }
}
