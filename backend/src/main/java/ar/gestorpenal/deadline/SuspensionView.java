package ar.gestorpenal.deadline;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** @param defendantId {@code null} when it applies to every defendant of the case */
record SuspensionView(
        UUID id,
        UUID caseId,
        UUID defendantId,
        String defendantName,
        SuspensionKind kind,
        LocalDate startsOn,
        LocalDate endsOn,
        boolean open,
        String notes,
        boolean archived,
        Instant createdAt) {}
