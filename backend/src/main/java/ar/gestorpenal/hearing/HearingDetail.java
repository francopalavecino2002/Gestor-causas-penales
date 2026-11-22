package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A hearing with its clashes (warnings) and its reschedule history, newest first. */
record HearingDetail(
        UUID id,
        UUID caseId,
        String caseCaption,
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
        List<NamedRef> lawyers,
        List<ClashView> clashes,
        List<RescheduleView> reschedules) {

    static HearingDetail of(HearingView head, List<ClashView> clashes, List<RescheduleView> reschedules) {
        return new HearingDetail(
                head.id(),
                head.caseId(),
                head.caseCaption(),
                head.typeCode(),
                head.typeName(),
                head.typeArticle(),
                head.startsAt(),
                head.durationMinutes(),
                head.room(),
                head.judge(),
                head.ofijuReference(),
                head.requestedBy(),
                head.statusCode(),
                head.statusName(),
                head.cancellationReasonCode(),
                head.cancellationReasonName(),
                head.heldAsTypeCode(),
                head.heldAsTypeName(),
                head.resultSummary(),
                head.nextHearingId(),
                head.notes(),
                head.archived(),
                head.createdAt(),
                head.defendants(),
                head.lawyers(),
                clashes,
                reschedules);
    }
}
