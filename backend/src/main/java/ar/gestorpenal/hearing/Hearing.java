package ar.gestorpenal.hearing;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A hearing (audiencia) of a case (ADR-0016). Archived, never deleted. The catalog codes are checked
 * against the firm's catalogs by {@link HearingService}; the rules that need no catalog are checked
 * here, before anything is assigned, so a rejected change leaves the hearing untouched.
 */
@Entity
@Audited
@Table(name = "hearing")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Hearing extends TenantScopedEntity {

    static final int DEFAULT_DURATION_MINUTES = 60;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "type_code", nullable = false, length = 60)
    private String typeCode;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(length = 100)
    private String room;

    @Column(length = 200)
    private String judge;

    @Column(name = "ofiju_reference", length = 100)
    private String ofijuReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "requested_by", length = 30)
    private RequestedBy requestedBy;

    @Column(name = "status_code", nullable = false, length = 60)
    private String statusCode;

    @Column(name = "cancellation_reason_code", length = 60)
    private String cancellationReasonCode;

    @Column(name = "held_as_type_code", length = 60)
    private String heldAsTypeCode;

    @Column(name = "result_summary")
    private String resultSummary;

    @Column(name = "next_hearing_id")
    private UUID nextHearingId;

    @Column
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static Hearing create(UUID caseId, HearingData data) {
        Hearing hearing = new Hearing();
        hearing.caseId = caseId;
        hearing.createdAt = Instant.now();
        hearing.apply(data);
        return hearing;
    }

    /** The status a hearing starts in when the data names none. */
    static String statusOf(HearingData data, String currentStatus) {
        String status = Text.clean(data.statusCode());
        if (status != null) {
            return status;
        }
        return currentStatus == null ? HearingRules.SCHEDULED : currentStatus;
    }

    /**
     * Replaces the editable fields. A hearing that is not stored yet takes the defaults for what the
     * data omits; an existing one keeps its status and duration, and its date can only change by
     * {@link #reschedule}.
     */
    void apply(HearingData data) {
        boolean creating = statusCode == null;
        Instant newStart = truncated(data.startsAt());
        if (!creating && !newStart.equals(startsAt)) {
            throw new InvalidHearingDataException("The date of a hearing changes by rescheduling it");
        }
        String status = statusOf(data, statusCode);
        HearingRules.requireNotRescheduledByHand(status, statusCode);
        String reason = Text.clean(data.cancellationReasonCode());
        String heldAs = Text.clean(data.heldAsTypeCode());
        String summary = Text.clean(data.resultSummary());
        UUID next = HearingRules.WITH_RESULT.contains(status) ? nextHearingId : null;
        HearingRules.requireConsistent(status, reason, heldAs, summary, next != null);

        this.typeCode = Text.clean(data.typeCode());
        this.startsAt = newStart;
        this.durationMinutes = data.durationMinutes() != null
                ? data.durationMinutes()
                : (creating ? DEFAULT_DURATION_MINUTES : durationMinutes);
        this.room = Text.clean(data.room());
        this.judge = Text.clean(data.judge());
        this.ofijuReference = Text.clean(data.ofijuReference());
        this.requestedBy = data.requestedBy();
        this.statusCode = status;
        this.cancellationReasonCode = reason;
        this.heldAsTypeCode = heldAs;
        this.resultSummary = summary;
        this.nextHearingId = next;
        this.notes = Text.clean(data.notes());
    }

    /** Moves the hearing to a new date and marks it {@code reprogramada}. The caller records the history. */
    void reschedule(Instant newStart) {
        Instant start = truncated(newStart);
        if (start.equals(startsAt)) {
            throw new InvalidHearingDataException("The new date is the same as the current one");
        }
        this.startsAt = start;
        this.statusCode = HearingRules.RESCHEDULED;
        this.cancellationReasonCode = null;
        this.heldAsTypeCode = null;
        this.resultSummary = null;
        this.nextHearingId = null;
    }

    /** Records how the hearing ended. The status must be one of {@link HearingRules#WITH_RESULT}. */
    void recordResult(String status, String heldAs, String summary) {
        HearingRules.requireResultStatus(status);
        HearingRules.requireConsistent(status, null, heldAs, summary, false);
        this.statusCode = status;
        this.cancellationReasonCode = null;
        this.heldAsTypeCode = heldAs;
        this.resultSummary = summary;
    }

    void linkNextHearing(UUID nextId) {
        this.nextHearingId = nextId;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    void restore() {
        archivedAt = null;
    }

    /** PostgreSQL keeps microseconds: compare and store at that precision. */
    static Instant truncated(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS);
    }
}
