package ar.gestorpenal.hearing;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Assisted alerts for a defendant who is deprived of liberty (ADR-0016). This is not the deadline
 * engine of T14: it only turns the dates loaded on a custodial measure into reminders, counting
 * calendar days (corridos, as for coercive measures). The system assists, the lawyer controls.
 */
final class DetaineeAlerts {

    /** Fixed text shown with every alert. */
    static final String DISCLAIMER = "Cálculo asistido: verificá con la norma.";

    static final String ARTICLE_DURATION = "116";
    static final String ARTICLE_REVIEW = "118";
    static final String ARTICLE_MAXIMUM = "119";

    private DetaineeAlerts() {}

    enum Kind {
        /** The fixed duration of the measure ends (art. 116). */
        ENDS,
        /** The next review hearing is due (art. 118). */
        REVIEW,
        /** One year of preventive prison, except in complex cases (art. 119). */
        MAX_DURATION,
        /** A preventive prison without a fixed duration (art. 116): the date is to be loaded. */
        NO_DURATION
    }

    /** The dates of one active custodial measure. */
    record MeasureDates(String measureCode, LocalDate startsOn, LocalDate endsOn, LocalDate nextReviewOn) {}

    /**
     * @param dueOn the day it falls due; {@code null} for {@link Kind#NO_DURATION}
     * @param daysLeft calendar days from today to {@code dueOn}, negative when overdue; {@code null}
     *     for {@link Kind#NO_DURATION}
     */
    record Alert(Kind kind, LocalDate dueOn, Long daysLeft, String article) {}

    /** The alerts of a measure that fall due within {@code withinDays} of {@code today}, or are already overdue. */
    static List<Alert> of(MeasureDates measure, LocalDate today, int withinDays) {
        List<Alert> alerts = new ArrayList<>();
        addIfDue(alerts, Kind.ENDS, measure.endsOn(), ARTICLE_DURATION, today, withinDays);
        addIfDue(alerts, Kind.REVIEW, measure.nextReviewOn(), ARTICLE_REVIEW, today, withinDays);
        if (CustodialMeasures.PREVENTIVE_PRISON.equals(measure.measureCode())) {
            addIfDue(alerts, Kind.MAX_DURATION, measure.startsOn().plusYears(1), ARTICLE_MAXIMUM, today, withinDays);
            if (measure.endsOn() == null) {
                alerts.add(new Alert(Kind.NO_DURATION, null, null, ARTICLE_DURATION));
            }
        }
        return alerts;
    }

    /** Orders {@link Alert#daysLeft}: overdue first (negative), then soonest; an alert without a date goes last. */
    static final Comparator<Long> MOST_URGENT_FIRST = Comparator.nullsLast(Comparator.naturalOrder());

    private static void addIfDue(
            List<Alert> alerts, Kind kind, LocalDate dueOn, String article, LocalDate today, int withinDays) {
        if (dueOn == null) {
            return;
        }
        long daysLeft = ChronoUnit.DAYS.between(today, dueOn);
        if (daysLeft <= withinDays) {
            alerts.add(new Alert(kind, dueOn, daysLeft, article));
        }
    }
}
