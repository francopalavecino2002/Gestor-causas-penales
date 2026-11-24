package ar.gestorpenal.task;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A task with the small references the screens show.
 *
 * @param overdue pending, not archived and due before today in the firm's zone
 * @param doneAt when it was marked done; {@code null} while pending
 * @param caseRef the linked case, or {@code null}; always set when {@code hearing} is
 * @param hearing the linked hearing, or {@code null}
 */
record TaskView(
        UUID id,
        String title,
        String notes,
        LocalDate dueDate,
        TaskStatus status,
        boolean overdue,
        Instant doneAt,
        MemberRef responsible,
        UUID createdBy,
        CaseLink caseRef,
        HearingLink hearing,
        boolean archived,
        Instant createdAt) {

    record MemberRef(UUID id, String displayName) {}

    record CaseLink(UUID id, String caption) {}

    record HearingLink(UUID id, String typeCode, String typeName, Instant startsAt) {}
}
