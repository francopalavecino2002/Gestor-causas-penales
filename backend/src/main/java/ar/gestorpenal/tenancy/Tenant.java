package ar.gestorpenal.tenancy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A law firm (estudio). The root of tenant isolation: it is the only entity that is not
 * {@link TenantScopedEntity tenant-scoped}.
 */
@Entity
@Table(name = "tenant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Tenant {

    public static final String DEFAULT_JURISDICTION = "neuquen";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, unique = true, updatable = false, length = 63)
    private String slug;

    @Column(name = "jurisdiction_code", nullable = false, length = 40)
    private String jurisdictionCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    public Tenant(String name, String slug) {
        this.name = Objects.requireNonNull(name, "name");
        this.slug = Objects.requireNonNull(slug, "slug");
        this.jurisdictionCode = DEFAULT_JURISDICTION;
        this.createdAt = Instant.now();
    }
}
