package ar.gestorpenal.hearing;

import ar.gestorpenal.hearing.DetaineeAlerts.Kind;
import java.time.LocalDate;
import java.util.UUID;

/**
 * An assisted alert about a detained defendant. {@code dueOn} and {@code daysLeft} are {@code null}
 * for {@link Kind#NO_DURATION}; {@code daysLeft} is negative when overdue.
 */
record DetaineeAlertView(
        Kind kind,
        LocalDate dueOn,
        Long daysLeft,
        String article,
        UUID caseId,
        String caseCaption,
        UUID defendantId,
        String defendantName,
        UUID measureId,
        String disclaimer) {}
