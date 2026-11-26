package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.DeadlineCalculator.Input;
import ar.gestorpenal.deadline.DeadlineCalculator.Result;
import ar.gestorpenal.tenancy.Tenant;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * The deadline calculator without login (ADR-0041): the built-in criminal rules of the default
 * jurisdiction (CPP Neuquén), computed with the same engine and court calendar the firms use, from a
 * start date alone. No firm settings, no extensions, no suspensions, nothing read from or written to
 * the database. Judicial deadlines are left out: their date is the one the court sets.
 */
@Component
class PublicDeadlineCalculator {

    private final DeadlinePackage deadlinePackage;
    private final DeadlineCalculator calculator;

    PublicDeadlineCalculator(DeadlinePackages packages) {
        this.deadlinePackage = packages.get(Tenant.DEFAULT_JURISDICTION, Tenant.DEFAULT_PRACTICE_AREA);
        this.calculator = new DeadlineCalculator(deadlinePackage.calendar(), DeadlineClock.ZONE);
    }

    /** The rules a start date is enough to compute, in package order. */
    List<PublicRuleView> rules() {
        return computableRules().stream().map(rule -> PublicRuleView.of(rule, deadlinePackage)).toList();
    }

    /**
     * @param startTime required for a term in hours, ignored otherwise
     * @throws DeadlineNotFoundException if the code is not a computable rule
     * @throws InvalidDeadlineDataException if the date is out of range or a term in hours has no time
     */
    PublicCalculationView calculate(String ruleCode, LocalDate startDate, LocalTime startTime) {
        DeadlineRule rule = computableRules().stream()
                .filter(candidate -> candidate.code().equals(ruleCode))
                .findFirst()
                .orElseThrow(() -> new DeadlineNotFoundException("There is no computable deadline rule " + ruleCode));
        if (startDate.getYear() < DeadlineRuleService.FIRST_CALENDAR_YEAR
                || startDate.getYear() > DeadlineRuleService.LAST_CALENDAR_YEAR) {
            throw new InvalidDeadlineDataException("startDate must be between the years "
                    + DeadlineRuleService.FIRST_CALENDAR_YEAR + " and " + DeadlineRuleService.LAST_CALENDAR_YEAR);
        }
        boolean hours = rule.computation() == Computation.HOURS;
        if (hours && startTime == null) {
            throw new InvalidDeadlineDataException("startTime is required for a term in hours");
        }
        LocalTime time = hours ? startTime.withSecond(0).withNano(0) : null;
        Instant startsAt = hours ? startDate.atTime(time).atZone(DeadlineClock.ZONE).toInstant() : null;
        Result result = calculator.compute(
                new Input(rule.computation(), rule.duration(), startsAt, startDate, null, List.of()));
        boolean usesCalendar = rule.computation() == Computation.BUSINESS_DAYS;
        return new PublicCalculationView(
                PublicRuleView.of(rule, deadlinePackage),
                startDate,
                time,
                result.outcome(),
                result.dueOn(),
                result.dueAt(),
                result.missingYear(),
                usesCalendar ? deadlinePackage.calendar().source() : null,
                usesCalendar ? deadlinePackage.calendar().flags() : List.of(),
                DeadlineViews.DISCLAIMER);
    }

    private List<DeadlineRule> computableRules() {
        return deadlinePackage.rules().stream()
                .filter(rule -> rule.computation() != Computation.SET_BY_COURT && rule.duration() != null)
                .toList();
    }
}
