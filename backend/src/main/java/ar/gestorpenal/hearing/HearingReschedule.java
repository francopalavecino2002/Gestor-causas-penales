package ar.gestorpenal.hearing;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** One change of date of a hearing. Append-only: a reschedule is never edited or removed. */
@Entity
@Audited
@Table(name = "hearing_reschedule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class HearingReschedule extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hearing_id", nullable = false, updatable = false)
    private UUID hearingId;

    @Column(name = "previous_starts_at", nullable = false, updatable = false)
    private Instant previousStartsAt;

    @Column(name = "new_starts_at", nullable = false, updatable = false)
    private Instant newStartsAt;

    @Column(length = 300, updatable = false)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_user_id", updatable = false)
    private UUID createdByUserId;

    static HearingReschedule create(
            UUID hearingId, Instant previousStartsAt, Instant newStartsAt, String reason, UUID createdByUserId) {
        HearingReschedule row = new HearingReschedule();
        row.hearingId = hearingId;
        row.previousStartsAt = previousStartsAt;
        row.newStartsAt = newStartsAt;
        row.reason = Text.clean(reason);
        row.createdAt = Instant.now();
        row.createdByUserId = createdByUserId;
        return row;
    }
}
