package ar.gestorpenal.deadline;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A deadline inside its alert window, as other features show it (the news wall). It always carries
 * the rule's legal source and the disclaimer: the system assists, the lawyer controls.
 */
public record DeadlineAlert(
        UUID id,
        UUID caseId,
        String caseCaption,
        String defendantName,
        String ruleName,
        String source,
        boolean detainee,
        LocalDate dueOn,
        Instant dueAt,
        Long daysLeft,
        Long hoursLeft,
        String disclaimer) {}
