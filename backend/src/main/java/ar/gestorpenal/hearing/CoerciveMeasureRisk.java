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

/** A procedural risk (item of the procedural-risks catalog) that justifies a preventive prison. */
@Entity
@Audited
@Table(name = "coercive_measure_risk")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CoerciveMeasureRisk extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "measure_id", nullable = false, updatable = false)
    private UUID measureId;

    @Column(name = "risk_code", nullable = false, updatable = false, length = 60)
    private String riskCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CoerciveMeasureRisk create(UUID measureId, String riskCode) {
        CoerciveMeasureRisk risk = new CoerciveMeasureRisk();
        risk.measureId = measureId;
        risk.riskCode = riskCode;
        risk.createdAt = Instant.now();
        return risk;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
