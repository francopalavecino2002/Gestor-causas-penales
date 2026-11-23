package ar.gestorpenal.demo;

import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * Weekday arithmetic for the demo agenda, so no hearing ever falls on a Saturday or Sunday. Court
 * holidays are ignored on purpose: the demo only needs a believable week.
 */
final class DemoCalendar {

    private DemoCalendar() {}

    /**
     * The weekday {@code offset} weekdays away from {@code today}. On a weekend, "today" counts as the
     * next Monday, so a demo shown on a Saturday opens on Monday's agenda.
     */
    static LocalDate weekday(LocalDate today, int offset) {
        LocalDate day = today;
        while (isWeekend(day)) {
            day = day.plusDays(1);
        }
        int step = Integer.signum(offset);
        int remaining = Math.abs(offset);
        while (remaining > 0) {
            day = day.plusDays(step);
            if (!isWeekend(day)) {
                remaining--;
            }
        }
        return day;
    }

    private static boolean isWeekend(LocalDate day) {
        return day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY;
    }
}
