package ar.gestorpenal.audit;

import ar.gestorpenal.tenancy.TenantScopedEntity;
import ar.gestorpenal.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Test-only audited entity with one field of each audit policy and an association. */
@Entity
@Table(name = "audit_probe")
@Audited
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class AuditProbe extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String label;

    @AuditRedacted
    @Column(length = 100)
    private String secret;

    @NotAudited
    @Column(nullable = false)
    private int counter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;

    @Column(name = "archived_at")
    private Instant archivedAt;

    AuditProbe(String label, String secret, AppUser owner) {
        this.label = label;
        this.secret = secret;
        this.owner = owner;
    }
}
