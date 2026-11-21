package ar.gestorpenal.tenancy;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.util.UUID;
import lombok.Getter;
import org.hibernate.annotations.TenantId;

/**
 * Base class for every business entity. Hibernate fills {@code tenantId} on insert from the
 * {@link CurrentTenantResolver} and adds {@code tenant_id = :current} to every query, so code
 * never sets or filters by tenant by hand (ADR-0007).
 *
 * <p>The table behind a subclass must declare {@code tenant_id uuid NOT NULL REFERENCES tenant(id)};
 * {@code TenantSchemaConventionTests} enforces it.
 */
@MappedSuperclass
@Getter
public abstract class TenantScopedEntity {

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;
}
