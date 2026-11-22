package ar.gestorpenal.deadline;

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
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Penal mediation or a federal extraordinary appeal loaded on a case (ADR-0017). Rebellion is not
 * loaded here: it is read from the defendant (art. 52). Archived, never deleted.
 */
@Entity
@Audited
@Table(name = "deadline_suspension")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class DeadlineSuspension extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "defendant_id")
    private UUID defendantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private SuspensionKind kind;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    @Column(name = "ends_on")
    private LocalDate endsOn;

    @Column
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static DeadlineSuspension create(UUID caseId, SuspensionData data) {
        DeadlineSuspension suspension = new DeadlineSuspension();
        suspension.caseId = caseId;
        suspension.createdAt = Instant.now();
        suspension.apply(data);
        return suspension;
    }

    /** Replaces every editable field; the defendant is checked against the case by the service. */
    void apply(SuspensionData data) {
        if (!data.kind().loadedByHand()) {
            throw new InvalidDeadlineDataException("Rebellion is taken from the defendant's dates: edit the defendant");
        }
        SupportedDates.require("startsOn", data.startsOn());
        SupportedDates.require("endsOn", data.endsOn());
        if (data.endsOn() != null && data.endsOn().isBefore(data.startsOn())) {
            throw new InvalidDeadlineDataException("A suspension cannot end before it starts");
        }
        this.kind = data.kind();
        this.defendantId = data.defendantId();
        this.startsOn = data.startsOn();
        this.endsOn = data.endsOn();
        this.notes = Text.clean(data.notes());
    }

    /** Whether it stops the clock of a deadline of {@code deadlineDefendantId} (null: a case deadline). */
    boolean appliesTo(UUID deadlineDefendantId) {
        return defendantId == null || defendantId.equals(deadlineDefendantId);
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
}
