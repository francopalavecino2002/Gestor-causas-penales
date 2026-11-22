package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.UUID;

/** One entry of a hearing's reschedule history. */
record RescheduleView(
        UUID id, Instant previousStartsAt, Instant newStartsAt, String reason, Instant createdAt, UUID createdByUserId) {

    static RescheduleView of(HearingReschedule row) {
        return new RescheduleView(
                row.getId(),
                row.getPreviousStartsAt(),
                row.getNewStartsAt(),
                row.getReason(),
                row.getCreatedAt(),
                row.getCreatedByUserId());
    }
}
