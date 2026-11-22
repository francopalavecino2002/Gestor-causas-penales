package ar.gestorpenal.deadline;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A deadline with its computed due date. Every due date travels with its rule, source and the
 * disclaimer "Cálculo asistido: verificá con la norma." (CLAUDE.md, rule 6).
 *
 * @param amount the rule's duration plus the granted extensions, in the unit of {@code rule.computation};
 *     {@code null} for a judicial deadline
 * @param dueOn the last day of the term; {@code null} when suspended or not calculable
 * @param dueAt the instant the term ends; {@code null} when suspended or not calculable
 * @param daysLeft calendar days from today to {@code dueOn}, negative when overdue
 * @param hoursLeft whole hours from now to {@code dueAt}, negative when overdue
 * @param suspendedDays calendar days the suspensions added to the term
 * @param missingYear the year the court calendar lacks, when {@code NOT_CALCULABLE}
 */
record DeadlineView(
        UUID id,
        UUID caseId,
        String caseCaption,
        UUID defendantId,
        String defendantName,
        RuleRef rule,
        LocalDate triggeredOn,
        Instant triggeredAt,
        LocalDate setDueOn,
        UUID hearingId,
        Integer amount,
        LocalDate dueOn,
        Instant dueAt,
        DeadlineStatus status,
        Long daysLeft,
        Long hoursLeft,
        int suspendedDays,
        Integer missingYear,
        List<ExtensionView> extensions,
        LocalDate metOn,
        String notes,
        boolean archived,
        Instant createdAt,
        String disclaimer) {

    /** What the screen shows of the rule next to each due date. */
    record RuleRef(
            String code,
            String name,
            String source,
            RuleKind kind,
            Computation computation,
            boolean detainee,
            String consequence,
            String caseLawStatus,
            String caseLawUrl,
            List<ReviewFlag> flags,
            boolean enabled) {}

    /** @param step 1 for the first extension granted, 2 for the second... */
    record ExtensionView(
            UUID id, int step, String grantedBy, int amount, LocalDate grantedOn, UUID grantedByHearingId, String notes) {}
}
