package ar.gestorpenal.tenancy;

import java.util.Optional;
import java.util.UUID;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Tells Hibernate which tenant a new session belongs to: an explicit {@link TenantContext}
 * scope first, then the authenticated {@link TenantPrincipal}.
 *
 * <p>Fails closed: when neither is present it returns {@link #NO_TENANT}, the nil UUID, which no
 * tenant row can have. Queries on tenant-scoped entities then match nothing and inserts violate
 * the {@code tenant_id} foreign key. Non-scoped work (for example creating a {@link Tenant}) still
 * works. No tenant is ever "root": cross-tenant reads are impossible through JPA.
 */
public class CurrentTenantResolver implements CurrentTenantIdentifierResolver<UUID> {

    public static final UUID NO_TENANT = new UUID(0L, 0L);

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        return TenantContext.explicitTenant()
                .or(CurrentTenantResolver::authenticatedTenant)
                .orElse(NO_TENANT);
    }

    /**
     * A session opened before the security context is populated stays bound to {@link #NO_TENANT}.
     * Authentication (T05) must set the principal before any transaction starts.
     */
    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }

    private static Optional<UUID> authenticatedTenant() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof TenantPrincipal principal) {
            return Optional.ofNullable(principal.tenantId());
        }
        return Optional.empty();
    }
}
