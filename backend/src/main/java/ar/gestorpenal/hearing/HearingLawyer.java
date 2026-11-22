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

/** A member of the firm who attends a hearing. Removing one archives the row. */
@Entity
@Audited
@Table(name = "hearing_lawyer")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class HearingLawyer extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hearing_id", nullable = false, updatable = false)
    private UUID hearingId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static HearingLawyer create(UUID hearingId, UUID userId) {
        HearingLawyer row = new HearingLawyer();
        row.hearingId = hearingId;
        row.userId = userId;
        row.createdAt = Instant.now();
        return row;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
