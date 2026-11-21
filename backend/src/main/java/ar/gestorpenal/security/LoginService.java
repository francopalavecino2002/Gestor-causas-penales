package ar.gestorpenal.security;

import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.time.Clock;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Checks firm + email + password. Every failure (unknown firm, unknown or archived user, wrong
 * password) looks the same to the caller and costs one password hash, so responses do not reveal
 * which firms or accounts exist.
 *
 * <p>Not transactional on purpose: the user lookup runs inside a {@link TenantContext} scope, which
 * must be entered before a transaction starts.
 */
@Service
class LoginService {

    private final TenantService tenants;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final LoginThrottle throttle;
    private final Clock clock;
    private final String hashForUnknownUsers;

    LoginService(
            TenantService tenants,
            UserRepository users,
            PasswordEncoder passwordEncoder,
            LoginThrottle throttle,
            Clock clock) {
        this.tenants = tenants;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.throttle = throttle;
        this.clock = clock;
        this.hashForUnknownUsers = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * @throws LoginThrottledException if there were too many recent failures
     * @throws BadCredentialsException if the credentials are not valid
     */
    AuthenticatedUser authenticate(LoginRequest request, String clientAddress) {
        String slug = request.tenant().strip().toLowerCase(Locale.ROOT);
        String email = UserService.normalizeEmail(request.email());
        String accountKey = slug + "|" + email;

        throttle.acquire(accountKey, clientAddress);
        AppUser user = verify(slug, email, request.password())
                .orElseThrow(() -> new BadCredentialsException("Invalid firm, email or password"));
        throttle.recordSuccess(accountKey, clientAddress);
        return AuthenticatedUser.of(user, clock.instant());
    }

    private Optional<AppUser> verify(String slug, String email, String password) {
        Optional<AppUser> candidate = tenants.findActiveIdBySlug(slug)
                .flatMap(tenantId -> TenantContext.callAs(tenantId, () -> users.findByEmail(email)))
                .filter(AppUser::isActive);
        if (!UserService.fitsPasswordHash(password)) {
            return Optional.empty();
        }
        String hash = candidate.map(AppUser::getPasswordHash).orElse(hashForUnknownUsers);
        boolean matches = passwordEncoder.matches(password, hash);
        return candidate.filter(user -> matches);
    }
}
