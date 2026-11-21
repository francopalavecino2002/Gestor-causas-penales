package ar.gestorpenal.security;

import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.tenancy.TenantService.TenantSummary;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import java.util.UUID;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The logged-in user and their firm, read fresh from the database. {@link ActiveUserFilter} has
 * already rejected archived users; the checks here only cover a race with archiving.
 */
@RestController
class MeController {

    private final UserRepository users;
    private final TenantService tenants;

    MeController(UserRepository users, TenantService tenants) {
        this.users = users;
        this.tenants = tenants;
    }

    @GetMapping("/api/v1/me")
    MeResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        AppUser user = users.findById(principal.userId())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InsufficientAuthenticationException("The user is no longer active"));
        TenantSummary tenant = tenants.describe(principal.tenantId())
                .orElseThrow(() -> new InsufficientAuthenticationException("The firm no longer exists"));
        return new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole(), tenant);
    }

    record MeResponse(UUID id, String email, String displayName, Role role, TenantSummary tenant) {}
}
