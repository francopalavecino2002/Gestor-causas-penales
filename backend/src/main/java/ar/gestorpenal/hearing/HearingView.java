package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A hearing as shown in lists: names resolved from the firm's catalogs, with its defendants and lawyers.
 * {@code practiceArea} is the code of the case's practice area, whose catalogs name the hearing.
 */
record HearingView(
        UUID id,
        UUID caseId,
        String caseCaption,
        String practiceArea,
        String typeCode,
        String typeName,
        String typeArticle,
        Instant startsAt,
        int durationMinutes,
        String room,
        String judge,
        String ofijuReference,
        RequestedBy requestedBy,
        String statusCode,
        String statusName,
        String cancellationReasonCode,
        String cancellationReasonName,
        String heldAsTypeCode,
        String heldAsTypeName,
        String resultSummary,
        UUID nextHearingId,
        String notes,
        boolean archived,
        Instant createdAt,
        List<NamedRef> defendants,
        List<NamedRef> lawyers) {}
