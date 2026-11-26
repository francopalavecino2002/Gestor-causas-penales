package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.DeadlineCalculator.Outcome;
import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * The result of one public calculation (ADR-0041). Nothing of it is stored.
 *
 * @param startTime only for a term in hours
 * @param outcome {@code DUE}, or {@code CALENDAR_NOT_LOADED} when a business-day term reaches a year
 *     the court calendar lacks (then there is no due date and {@code missingYear} says which)
 * @param dueOn the last day of the term in Neuquén's zone
 * @param dueAt the instant the term ends: 24 h of the last day for day terms
 * @param calendarSource where the court's non-business days come from, for business-day terms
 */
record PublicCalculationView(
        PublicRuleView rule,
        LocalDate startDate,
        LocalTime startTime,
        Outcome outcome,
        LocalDate dueOn,
        Instant dueAt,
        Integer missingYear,
        String calendarSource,
        List<ReviewFlag> calendarFlags,
        String disclaimer) {}
