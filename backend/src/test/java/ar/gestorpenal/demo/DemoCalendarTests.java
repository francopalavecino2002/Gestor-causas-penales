package ar.gestorpenal.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DemoCalendarTests {

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 11, 25);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 11, 28);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 11, 29);
    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 30);

    @Test
    void shouldKeepTodayWhenItIsAWeekday() {
        assertThat(DemoCalendar.weekday(WEDNESDAY, 0)).isEqualTo(WEDNESDAY);
    }

    @Test
    void shouldSkipTheWeekendGoingForward() {
        assertThat(DemoCalendar.weekday(WEDNESDAY, 2)).isEqualTo(FRIDAY);
        assertThat(DemoCalendar.weekday(WEDNESDAY, 3)).isEqualTo(MONDAY);
        assertThat(DemoCalendar.weekday(FRIDAY, 1)).isEqualTo(MONDAY);
    }

    @Test
    void shouldSkipTheWeekendGoingBack() {
        assertThat(DemoCalendar.weekday(MONDAY, -1)).isEqualTo(FRIDAY);
        assertThat(DemoCalendar.weekday(WEDNESDAY, -2)).isEqualTo(LocalDate.of(2026, 11, 23));
        assertThat(DemoCalendar.weekday(MONDAY, -3)).isEqualTo(WEDNESDAY);
    }

    @Test
    void shouldStartFromTheNextMondayOnAWeekend() {
        assertThat(DemoCalendar.weekday(SATURDAY, 0)).isEqualTo(MONDAY);
        assertThat(DemoCalendar.weekday(SUNDAY, 0)).isEqualTo(MONDAY);
        assertThat(DemoCalendar.weekday(SUNDAY, -1)).isEqualTo(FRIDAY);
        assertThat(DemoCalendar.weekday(SATURDAY, 1)).isEqualTo(MONDAY.plusDays(1));
    }
}
