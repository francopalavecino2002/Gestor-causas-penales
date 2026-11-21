package ar.gestorpenal.tenancy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Minimal tenant-scoped entity used only to prove isolation before real entities exist. */
@Entity
@Table(name = "isolation_probe")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class IsolationProbe extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String label;

    IsolationProbe(String label) {
        this.label = label;
    }
}
