package ar.gestorpenal.security;

import ar.gestorpenal.tenancy.TenantPrincipal;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import java.io.Serializable;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.AuthenticatedPrincipal;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * The principal stored in the HTTP session after login. It carries ids only (no password hash, no
 * personal data) and gives Hibernate the tenant of every request (ADR-0007). {@link ActiveUserFilter}
 * re-checks it on every request.
 */
public record AuthenticatedUser(UUID userId, UUID tenantId, Role role, Instant authenticatedAt)
        implements TenantPrincipal, AuthenticatedPrincipal, Serializable {

    static AuthenticatedUser of(AppUser user, Instant authenticatedAt) {
        return new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), authenticatedAt);
    }

    List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority(role.authority()));
    }

    @Override
    public String getName() {
        return userId.toString();
    }
}
