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

/** A defendant a hearing is about. Removing one archives the row. */
@Entity
@Audited
@Table(name = "hearing_defendant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class HearingDefendant extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hearing_id", nullable = false, updatable = false)
    private UUID hearingId;

    @Column(name = "defendant_id", nullable = false, updatable = false)
    private UUID defendantId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static HearingDefendant create(UUID hearingId, UUID defendantId) {
        HearingDefendant row = new HearingDefendant();
        row.hearingId = hearingId;
        row.defendantId = defendantId;
        row.createdAt = Instant.now();
        return row;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
