package ar.gestorpenal.deadline;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A deadline as the client sends it. Which dates apply depends on the rule's computation: a term in
 * hours needs {@code triggeredAt}; any other needs {@code triggeredOn}; a judicial deadline also needs
 * {@code setDueOn}. The rule and the defendant are fixed once the deadline exists.
 *
 * @param metOn the day the act was done (cumplido); {@code null} while it runs
 */
record DeadlineData(
        @NotBlank @Size(max = 60) String ruleCode,
        UUID defendantId,
        LocalDate triggeredOn,
        Instant triggeredAt,
        LocalDate setDueOn,
        UUID hearingId,
        LocalDate metOn,
        @Size(max = 4000) String notes) {}
