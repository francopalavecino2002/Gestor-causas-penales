package ar.gestorpenal.tenancy;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The only global (cross-tenant) read path. Package-private on purpose: other features reach
 * tenants through a narrow service in this package, never by listing every firm.
 */
interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findBySlug(String slug);
}
