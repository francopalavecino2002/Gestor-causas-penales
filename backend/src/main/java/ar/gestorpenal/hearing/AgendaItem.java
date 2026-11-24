package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One hearing of the agenda. {@code detainee} is set when a listed defendant has an active custodial
 * measure; {@code hasClash} when the hearing overlaps another one of any of its lawyers. {@code practiceArea}
 * is the code of the case's practice area, so the agenda can tell areas apart.
 */
record AgendaItem(
        UUID hearingId,
        UUID caseId,
        String caseCaption,
        String practiceArea,
        String typeCode,
        String typeName,
        String typeArticle,
        String statusCode,
        String statusName,
        Instant startsAt,
        int durationMinutes,
        String room,
        String judge,
        List<NamedRef> defendants,
        List<NamedRef> lawyers,
        boolean detainee,
        boolean hasClash) {

    static AgendaItem of(HearingView hearing, boolean detainee, boolean hasClash) {
        return new AgendaItem(
                hearing.id(),
                hearing.caseId(),
                hearing.caseCaption(),
                hearing.practiceArea(),
                hearing.typeCode(),
                hearing.typeName(),
                hearing.typeArticle(),
                hearing.statusCode(),
                hearing.statusName(),
                hearing.startsAt(),
                hearing.durationMinutes(),
                hearing.room(),
                hearing.judge(),
                hearing.defendants(),
                hearing.lawyers(),
                detainee,
                hasClash);
    }
}
