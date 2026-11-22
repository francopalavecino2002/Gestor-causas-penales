package ar.gestorpenal.deadline;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * An extension granted on a deadline (ADR-0017). Append-only: a mistaken one is archived, and the
 * limits of the rule (how many, how long each) are checked by {@link DeadlineService}.
 */
@Entity
@Audited
@Table(name = "deadline_extension")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class DeadlineExtension extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "deadline_id", nullable = false, updatable = false)
    private UUID deadlineId;

    @Column(nullable = false, updatable = false)
    private int amount;

    @Column(name = "granted_on", nullable = false, updatable = false)
    private LocalDate grantedOn;

    @Column(name = "granted_by_hearing_id", updatable = false)
    private UUID grantedByHearingId;

    @Column(updatable = false)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static DeadlineExtension create(UUID deadlineId, ExtensionData data) {
        DeadlineExtension extension = new DeadlineExtension();
        extension.deadlineId = deadlineId;
        extension.amount = data.amount();
        extension.grantedOn = data.grantedOn();
        extension.grantedByHearingId = data.grantedByHearingId();
        extension.notes = Text.clean(data.notes());
        extension.createdAt = Instant.now();
        return extension;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
