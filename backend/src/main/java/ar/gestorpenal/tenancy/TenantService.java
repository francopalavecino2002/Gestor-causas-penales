package ar.gestorpenal.tenancy;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to firms. It never lists tenants: callers either create one or
 * look up a single firm they already know (by slug at login, by id from the session).
 */
@Service
public class TenantService {

    private final TenantRepository tenants;

    TenantService(TenantRepository tenants) {
        this.tenants = tenants;
    }

    @Transactional
    public TenantSummary create(String name, String slug) {
        return TenantSummary.of(tenants.save(new Tenant(name, slug)));
    }

    /** The id of a non-archived firm, used to scope the login lookup. */
    @Transactional(readOnly = true)
    public Optional<UUID> findActiveIdBySlug(String slug) {
        return tenants.findBySlug(slug)
                .filter(tenant -> tenant.getArchivedAt() == null)
                .map(Tenant::getId);
    }

    @Transactional(readOnly = true)
    public Optional<TenantSummary> describe(UUID tenantId) {
        return tenants.findById(tenantId).map(TenantSummary::of);
    }

    public record TenantSummary(UUID id, String name, String slug) {

        static TenantSummary of(Tenant tenant) {
            return new TenantSummary(tenant.getId(), tenant.getName(), tenant.getSlug());
        }
    }
}
