package ar.gestorpenal.deadline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import ar.gestorpenal.deadline.CourtCalendar.NonBusinessDay;
import ar.gestorpenal.deadline.DeadlineCalculator.Input;
import ar.gestorpenal.deadline.DeadlineCalculator.Outcome;
import ar.gestorpenal.deadline.DeadlineCalculator.Result;
import ar.gestorpenal.deadline.DeadlineCalculator.Suspension;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Every computation type of art. 79, on a small fixture calendar: 2026 only, with Monday 23 and
 * Tuesday 24 March and Thursday 2 and Friday 3 April as non-business days.
 */
class DeadlineCalculatorTests {

    private static final CourtCalendar CALENDAR = new CourtCalendar(
            Set.of(2026),
            days("2026-03-23", "2026-03-24", "2026-04-02", "2026-04-03"),
            "fixture",
            List.of());

    private final DeadlineCalculator calculator = new DeadlineCalculator(CALENDAR, DeadlineClock.ZONE);

    private static Map<LocalDate, NonBusinessDay> days(String... dates) {
        return Arrays.stream(dates)
                .map(LocalDate::parse)
                .collect(Collectors.toMap(Function.identity(), day -> new NonBusinessDay(day, "Feriado ficticio", List.of())));
    }

    private static LocalDate day(String date) {
        return LocalDate.parse(date);
    }

    private static Instant local(String dateTime) {
        return OffsetDateTime.parse(dateTime + "-03:00").toInstant();
    }

    private Result days(Computation computation, int amount, String triggeredOn, Suspension... suspensions) {
        return calculator.compute(new Input(computation, amount, null, day(triggeredOn), null, List.of(suspensions)));
    }

    private static Suspension closed(String from, String to) {
        return new Suspension(day(from), day(to));
    }

    private static Suspension open(String from) {
        return new Suspension(day(from), null);
    }

    @Nested
    class Hours {

        private Result hours(int amount, Instant triggeredAt) {
            return calculator.compute(new Input(Computation.HOURS, amount, triggeredAt, null, null, List.of()));
        }

        @Test
        void shouldRunContinuouslyAcrossMidnight() {
            Result result = hours(24, local("2026-05-10T22:30"));

            assertThat(result.outcome()).isEqualTo(Outcome.DUE);
            assertThat(result.dueAt()).isEqualTo(local("2026-05-11T22:30"));
            assertThat(result.dueOn()).isEqualTo(day("2026-05-11"));
        }

        @Test
        void shouldIgnoreWeekendsAndHolidays() {
            // Friday 20 March + 72 h runs over the weekend and the two holidays.
            Result result = hours(72, local("2026-03-20T10:00"));

            assertThat(result.dueAt()).isEqualTo(local("2026-03-23T10:00"));
        }

        @Test
        void shouldNotNeedTheCourtCalendar() {
            Result result = hours(24, local("2031-01-01T08:00"));

            assertThat(result.outcome()).isEqualTo(Outcome.DUE);
            assertThat(result.dueAt()).isEqualTo(local("2031-01-02T08:00"));
        }

        @Test
        void shouldUseTheFirmsZoneForTheLastDay() {
            // 23:30 in Neuquén is already the next day in UTC; the due day is the local one.
            Result result = hours(24, local("2026-05-10T23:30"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-11"));
        }
    }

    @Nested
    class BusinessDays {

        @Test
        void shouldSkipWeekendsAndHolidaysAndEndAtMidnightOfTheLastDay() {
            // Friday 20 March: Sat, Sun, Mon 23 and Tue 24 do not count; Wed 25 is the first day.
            Result result = days(Computation.BUSINESS_DAYS, 5, "2026-03-20");

            assertThat(result.outcome()).isEqualTo(Outcome.DUE);
            assertThat(result.dueOn()).isEqualTo(day("2026-03-31"));
            assertThat(result.dueAt()).isEqualTo(local("2026-04-01T00:00"));
            assertThat(result.suspendedDays()).isZero();
        }

        @Test
        void shouldStartCountingTheDayAfterTheTrigger() {
            // Wednesday 1 April: Thursday 2 and Friday 3 are holidays, so Monday 6 is the first day.
            assertThat(days(Computation.BUSINESS_DAYS, 3, "2026-04-01").dueOn()).isEqualTo(day("2026-04-08"));
            assertThat(days(Computation.BUSINESS_DAYS, 1, "2026-05-11").dueOn()).isEqualTo(day("2026-05-12"));
        }

        @Test
        void shouldCountFromTheNextBusinessDayWhenTriggeredOnAWeekend() {
            assertThat(days(Computation.BUSINESS_DAYS, 1, "2026-05-09").dueOn()).isEqualTo(day("2026-05-11"));
        }

        @Test
        void shouldNotGuessAYearTheCalendarDoesNotHave() {
            // Wednesday 30 December 2026: the 31st counts, then the term reaches 2027.
            Result result = days(Computation.BUSINESS_DAYS, 5, "2026-12-30");

            assertThat(result.outcome()).isEqualTo(Outcome.CALENDAR_NOT_LOADED);
            assertThat(result.missingYear()).isEqualTo(2027);
            assertThat(result.dueOn()).isNull();
            assertThat(result.dueAt()).isNull();
        }

        @Test
        void shouldNotCountSuspendedDays() {
            // Monday 11 May: Tuesday 12 and Wednesday 13 are suspended.
            Result result = days(Computation.BUSINESS_DAYS, 3, "2026-05-11", closed("2026-05-12", "2026-05-13"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-18"));
            assertThat(result.suspendedDays()).isEqualTo(2);
        }

        @Test
        void shouldStaySuspendedWhileASuspensionHasNoEnd() {
            Result result = days(Computation.BUSINESS_DAYS, 3, "2026-05-11", open("2026-05-13"));

            assertThat(result.outcome()).isEqualTo(Outcome.SUSPENDED);
            assertThat(result.dueOn()).isNull();
            assertThat(result.suspendedDays()).isZero();
        }

        @Test
        void shouldIgnoreAnOpenSuspensionThatStartsAfterTheTermEnded() {
            Result result = days(Computation.BUSINESS_DAYS, 3, "2026-05-11", open("2026-06-01"));

            assertThat(result.outcome()).isEqualTo(Outcome.DUE);
            assertThat(result.dueOn()).isEqualTo(day("2026-05-14"));
        }
    }

    @Nested
    class CalendarDays {

        @Test
        void shouldCountWeekendsAndHolidays() {
            assertThat(days(Computation.CALENDAR_DAYS, 5, "2026-03-20").dueOn()).isEqualTo(day("2026-03-25"));
        }

        @Test
        void shouldNotMoveALastDayThatIsAHoliday() {
            assertThat(days(Computation.CALENDAR_DAYS, 5, "2026-03-19").dueOn()).isEqualTo(day("2026-03-24"));
        }

        @Test
        void shouldCrossTheEndOfFebruary() {
            assertThat(days(Computation.CALENDAR_DAYS, 5, "2026-02-26").dueOn()).isEqualTo(day("2026-03-03"));
        }

        @Test
        void shouldNotNeedTheCourtCalendar() {
            assertThat(days(Computation.CALENDAR_DAYS, 5, "2030-12-30").dueOn()).isEqualTo(day("2031-01-04"));
        }

        @Test
        void shouldAddTheSuspendedDays() {
            Result result = days(Computation.CALENDAR_DAYS, 5, "2026-03-20", closed("2026-03-22", "2026-03-23"));

            assertThat(result.dueOn()).isEqualTo(day("2026-03-27"));
            assertThat(result.suspendedDays()).isEqualTo(2);
        }
    }

    @Nested
    class Months {

        @Test
        void shouldGoDateToDate() {
            assertThat(days(Computation.MONTHS, 4, "2026-01-15").dueOn()).isEqualTo(day("2026-05-15"));
        }

        @Test
        void shouldEndOnTheLastDayOfAShorterMonth() {
            assertThat(days(Computation.MONTHS, 4, "2025-10-31").dueOn()).isEqualTo(day("2026-02-28"));
            assertThat(days(Computation.MONTHS, 4, "2027-10-31").dueOn()).isEqualTo(day("2028-02-29"));
        }

        @Test
        void shouldAddTheGrantedExtensionsToTheAmount() {
            // Art. 158: 4 months plus two extensions of 4 months each.
            assertThat(days(Computation.MONTHS, 4 + 4, "2026-01-15").dueOn()).isEqualTo(day("2026-09-15"));
            assertThat(days(Computation.MONTHS, 4 + 4 + 4, "2026-01-15").dueOn()).isEqualTo(day("2027-01-15"));
        }

        @Test
        void shouldMoveTheEndByTheSuspendedDays() {
            Result result = days(Computation.MONTHS, 4, "2026-01-15", closed("2026-02-01", "2026-02-10"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-25"));
            assertThat(result.suspendedDays()).isEqualTo(10);
        }

        @Test
        void shouldCountASuspensionThatTheLongerTermNowReaches() {
            // The first suspension moves the end to 25 May, which then reaches the second one.
            Result result = days(Computation.MONTHS, 4, "2026-01-15",
                    closed("2026-02-01", "2026-02-10"), closed("2026-05-20", "2026-05-24"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-30"));
            assertThat(result.suspendedDays()).isEqualTo(15);
        }

        @Test
        void shouldCountOverlappingSuspensionsOnce() {
            Result result = days(Computation.MONTHS, 4, "2026-01-15",
                    closed("2026-02-01", "2026-02-10"), closed("2026-02-05", "2026-02-15"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-30"));
            assertThat(result.suspendedDays()).isEqualTo(15);
        }

        @Test
        void shouldIgnoreSuspensionsOutsideTheTerm() {
            Result result = days(Computation.MONTHS, 4, "2026-01-15",
                    closed("2025-12-01", "2026-01-15"), closed("2026-06-01", "2026-06-30"));

            assertThat(result.dueOn()).isEqualTo(day("2026-05-15"));
            assertThat(result.suspendedDays()).isZero();
        }

        @Test
        void shouldCountASuspensionNestedInsideAnother() {
            Result result = days(Computation.MONTHS, 4, "2026-01-15",
                    closed("2026-02-01", "2026-02-20"), closed("2026-02-05", "2026-02-10"));

            assertThat(result.dueOn()).isEqualTo(day("2026-06-04"));
            assertThat(result.suspendedDays()).isEqualTo(20);
        }

        @Test
        void shouldStaySuspendedWhileASuspensionHasNoEnd() {
            Result started = days(Computation.MONTHS, 4, "2026-01-15", open("2026-03-01"));
            Result fromBefore = days(Computation.MONTHS, 4, "2026-01-15", open("2025-12-01"));

            assertThat(started.outcome()).isEqualTo(Outcome.SUSPENDED);
            assertThat(started.suspendedDays()).isEqualTo(76);
            assertThat(fromBefore.outcome()).isEqualTo(Outcome.SUSPENDED);
        }
    }

    @Nested
    class Years {

        @Test
        void shouldEndOn28FebruaryWhenItStartedOn29February() {
            assertThat(days(Computation.YEARS, 1, "2024-02-29").dueOn()).isEqualTo(day("2025-02-28"));
        }

        @Test
        void shouldMoveTheEndByARebellion() {
            // Art. 87: 3 years; a rebellion of 31 days (art. 52) does not count.
            Result result = days(Computation.YEARS, 3, "2026-03-01", closed("2027-01-01", "2027-01-31"));

            assertThat(result.dueOn()).isEqualTo(day("2029-04-01"));
            assertThat(result.dueAt()).isEqualTo(local("2029-04-02T00:00"));
            assertThat(result.suspendedDays()).isEqualTo(31);
        }
    }

    @Nested
    class SetByCourt {

        private Result setByCourt(String triggeredOn, String setDueOn, Suspension... suspensions) {
            return calculator.compute(new Input(
                    Computation.SET_BY_COURT, 0, null, day(triggeredOn), day(setDueOn), List.of(suspensions)));
        }

        @Test
        void shouldUseTheDateTheCourtSet() {
            Result result = setByCourt("2026-05-01", "2026-06-30");

            assertThat(result.dueOn()).isEqualTo(day("2026-06-30"));
            assertThat(result.dueAt()).isEqualTo(local("2026-07-01T00:00"));
        }

        @Test
        void shouldMoveTheDateByTheSuspendedDays() {
            assertThat(setByCourt("2026-05-01", "2026-06-30", closed("2026-05-10", "2026-05-19")).dueOn())
                    .isEqualTo(day("2026-07-10"));
        }
    }

    @Test
    void shouldRejectASuspensionThatEndsBeforeItStarts() {
        assertThatIllegalArgumentException().isThrownBy(() -> closed("2026-05-10", "2026-05-09"));
    }
}
