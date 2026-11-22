package ar.gestorpenal.deadline;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.time.LocalDate;
import java.util.List;

/**
 * A built-in deadline rule of a jurisdiction package (ADR-0017), as read from
 * {@code deadline-rules.yml}. Firms cannot change it; they can only disable it or change its alert.
 *
 * @param article the article of the code, or {@code null} when {@code law} alone is the source
 * @param law the law it comes from, or {@code null} for the package's code of procedure
 * @param duration the term in the unit of {@code computation}; {@code null} for {@link Computation#SET_BY_COURT}
 * @param detainee whether it protects a person deprived of liberty: shown first
 * @param extensions the extensions the law allows, in the order they are granted
 * @param suspendedBy the events that stop its clock
 * @param alertDaysBefore default warning, in days before the due date
 */
record DeadlineRule(
        String code,
        String name,
        String article,
        String law,
        String trigger,
        RuleKind kind,
        Computation computation,
        Integer duration,
        RuleScope scope,
        boolean detainee,
        String consequence,
        CaseLaw caseLaw,
        List<ExtensionStep> extensions,
        List<SuspensionKind> suspendedBy,
        int alertDaysBefore,
        List<ReviewFlag> flags,
        String note) {

    DeadlineRule {
        extensions = extensions == null ? List.of() : List.copyOf(extensions);
        suspendedBy = suspendedBy == null ? List.of() : List.copyOf(suspendedBy);
        flags = flags == null ? List.of() : List.copyOf(flags);
    }

    /** Case-law status of the rule: a short text, an optional link and the day it was last reviewed. */
    record CaseLaw(String status, String url, LocalDate reviewedOn) {}

    /** One extension the law allows: who grants it and its maximum, in the rule's unit. */
    record ExtensionStep(String grantedBy, int maxAmount) {}

    boolean isSuspendedBy(SuspensionKind kind) {
        return suspendedBy.contains(kind);
    }
}
