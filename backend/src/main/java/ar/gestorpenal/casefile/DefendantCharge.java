package ar.gestorpenal.casefile;

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

/** An offence a defendant is charged with. Kept simple: the offence and its legal reference. */
@Entity
@Audited
@Table(name = "defendant_charge")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class DefendantCharge extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "defendant_id", nullable = false, updatable = false)
    private UUID defendantId;

    @Column(nullable = false, length = 200)
    private String offence;

    @Column(name = "legal_reference", length = 100)
    private String legalReference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static DefendantCharge create(UUID defendantId, ChargeData data) {
        DefendantCharge charge = new DefendantCharge();
        charge.defendantId = defendantId;
        charge.createdAt = Instant.now();
        charge.apply(data);
        return charge;
    }

    void apply(ChargeData data) {
        String offence = Text.clean(data.offence());
        if (offence == null) {
            throw new InvalidCaseDataException("A charge needs an offence");
        }
        this.offence = offence;
        this.legalReference = Text.clean(data.legalReference());
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
