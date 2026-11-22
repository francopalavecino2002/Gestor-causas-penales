package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.hearing.DetaineeAlerts.Alert;
import ar.gestorpenal.hearing.DetaineeAlerts.Kind;
import ar.gestorpenal.hearing.DetaineeAlerts.MeasureDates;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;

class DetaineeAlertsTests {

    private static final LocalDate TODAY = LocalDate.of(2026, 12, 10);

    @Test
    void shouldAlertWhenTheFixedDurationEndsWithinTheWindow() {
        MeasureDates measure = preventive(TODAY.minusDays(30), TODAY.plusDays(5), null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15))
                .contains(new Alert(Kind.ENDS, TODAY.plusDays(5), 5L, "116"));
    }

    @Test
    void shouldNotAlertWhenTheDurationEndsAfterTheWindow() {
        MeasureDates measure = preventive(TODAY.minusDays(30), TODAY.plusDays(16), null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15)).extracting(Alert::kind).doesNotContain(Kind.ENDS);
    }

    @Test
    void shouldAlertWithNegativeDaysWhenTheDurationAlreadyEnded() {
        MeasureDates measure = preventive(TODAY.minusDays(60), TODAY.minusDays(3), null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15))
                .contains(new Alert(Kind.ENDS, TODAY.minusDays(3), -3L, "116"));
    }

    @Test
    void shouldAlertWhenTheNextReviewIsDue() {
        MeasureDates measure = preventive(TODAY.minusDays(30), TODAY.plusDays(60), TODAY.plusDays(15));

        assertThat(DetaineeAlerts.of(measure, TODAY, 15))
                .containsExactly(new Alert(Kind.REVIEW, TODAY.plusDays(15), 15L, "118"));
    }

    @Test
    void shouldAlertWhenPreventivePrisonReachesOneYear() {
        MeasureDates measure = preventive(TODAY.minusYears(1).plusDays(7), TODAY.plusDays(90), null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15))
                .containsExactly(new Alert(Kind.MAX_DURATION, TODAY.plusDays(7), 7L, "119"));
    }

    @Test
    void shouldAlertAPreventivePrisonWithoutAFixedDuration() {
        MeasureDates measure = preventive(TODAY.minusDays(10), null, null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15)).containsExactly(new Alert(Kind.NO_DURATION, null, null, "116"));
    }

    @Test
    void houseArrestShouldOnlyHaveTheDatesItWasGiven() {
        MeasureDates measure = new MeasureDates("detencion-domiciliaria", TODAY.minusYears(2), null, null);

        assertThat(DetaineeAlerts.of(measure, TODAY, 15)).isEmpty();
        assertThat(DetaineeAlerts.of(
                        new MeasureDates("detencion-domiciliaria", TODAY.minusDays(9), TODAY.plusDays(2), null), TODAY, 15))
                .extracting(Alert::kind)
                .containsExactly(Kind.ENDS);
    }

    @Test
    void shouldOrderOverdueFirstThenSoonestAndUndatedLast() {
        Alert noDate = new Alert(Kind.NO_DURATION, null, null, "116");
        Alert soon = new Alert(Kind.REVIEW, TODAY.plusDays(2), 2L, "118");
        Alert overdue = new Alert(Kind.ENDS, TODAY.minusDays(4), -4L, "116");
        Alert later = new Alert(Kind.MAX_DURATION, TODAY.plusDays(9), 9L, "119");

        List<Alert> sorted = List.of(noDate, later, soon, overdue).stream()
                .sorted(Comparator.comparing(Alert::daysLeft, DetaineeAlerts.MOST_URGENT_FIRST))
                .toList();

        assertThat(sorted).containsExactly(overdue, soon, later, noDate);
    }

    private static MeasureDates preventive(LocalDate startsOn, LocalDate endsOn, LocalDate nextReviewOn) {
        return new MeasureDates(CustodialMeasures.PREVENTIVE_PRISON, startsOn, endsOn, nextReviewOn);
    }
}
