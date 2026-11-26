package ar.gestorpenal.fee;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * The value of the JUS in pesos from a day on, as the firm copied it from the official source
 * (ADR-0040). It is not edited: a correction is a new value, a wrong entry is archived, never deleted.
 */
@Entity
@Audited
@Table(name = "jus_value")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class JusValue extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal value;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static JusValue create(UUID createdBy, BigDecimal value, LocalDate validFrom, Instant now) {
        JusValue jus = new JusValue();
        jus.createdBy = createdBy;
        jus.value = value;
        jus.validFrom = validFrom;
        jus.createdAt = now;
        return jus;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive(Instant now) {
        if (archivedAt == null) {
            archivedAt = now;
        }
    }

    void restore() {
        archivedAt = null;
    }
}
