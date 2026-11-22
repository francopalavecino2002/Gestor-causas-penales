package ar.gestorpenal.deadline;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

/**
 * The non-business days of a jurisdiction's courts (ADR-0017). Saturdays and Sundays are never
 * business days. Only the loaded years are known: asking about another year throws
 * {@link CalendarNotLoadedException}, so a deadline is never computed on a guessed calendar.
 */
final class CourtCalendar {

    /** One non-business day and why. */
    record NonBusinessDay(LocalDate date, String name, List<ReviewFlag> flags) {}

    private final Set<Integer> years;
    private final NavigableMap<LocalDate, NonBusinessDay> days;
    private final String source;
    private final List<ReviewFlag> flags;

    CourtCalendar(Set<Integer> years, Map<LocalDate, NonBusinessDay> days, String source, List<ReviewFlag> flags) {
        this.years = Set.copyOf(years);
        this.days = new TreeMap<>(days);
        this.source = source;
        this.flags = flags == null ? List.of() : List.copyOf(flags);
    }

    boolean isBusinessDay(LocalDate day) {
        if (!years.contains(day.getYear())) {
            throw new CalendarNotLoadedException(day.getYear());
        }
        DayOfWeek weekday = day.getDayOfWeek();
        return weekday != DayOfWeek.SATURDAY && weekday != DayOfWeek.SUNDAY && !days.containsKey(day);
    }

    boolean covers(int year) {
        return years.contains(year);
    }

    /** The listed non-business days of {@code year} (weekends are not listed), in date order. */
    List<NonBusinessDay> nonBusinessDays(int year) {
        return List.copyOf(days.subMap(LocalDate.of(year, 1, 1), true, LocalDate.of(year, 12, 31), true).values());
    }

    String source() {
        return source;
    }

    List<ReviewFlag> flags() {
        return flags;
    }

    /** A business-day term reached a year the calendar does not have. */
    static final class CalendarNotLoadedException extends RuntimeException {

        private final int year;

        CalendarNotLoadedException(int year) {
            super("The court calendar has no data for " + year);
            this.year = year;
        }

        int year() {
            return year;
        }
    }
}
