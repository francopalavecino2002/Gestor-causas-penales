package ar.gestorpenal.security;

import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Checks firm + email + password, then the second factor when the user has one (ADR-0009). Every
 * password failure (unknown firm, unknown or archived user, wrong password) looks the same to the
 * caller and costs one password hash, so responses do not reveal which firms or accounts exist.
 *
 * <p>Both steps draw on the same throttle budget: a valid password that still needs a code keeps its
 * reserved attempt, and only a complete login refunds it.
 *
 * <p>Not transactional on purpose: the user lookups run inside a {@link TenantContext} scope, which
 * must be entered before a transaction starts.
 */
@Service
class LoginService {

    private final TenantService tenants;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final LoginThrottle throttle;
    private final TwoFactorService twoFactor;
    private final EmailVerificationService emailVerification;
    private final Clock clock;
    private final Duration secondFactorTimeout;
    private final String hashForUnknownUsers;

    LoginService(
            TenantService tenants,
            UserRepository users,
            PasswordEncoder passwordEncoder,
            LoginThrottle throttle,
            TwoFactorService twoFactor,
            EmailVerificationService emailVerification,
            Clock clock,
            @Value("${app.security.two-factor.login-timeout}") Duration secondFactorTimeout) {
        this.tenants = tenants;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.throttle = throttle;
        this.twoFactor = twoFactor;
        this.emailVerification = emailVerification;
        this.clock = clock;
        this.secondFactorTimeout = secondFactorTimeout;
        this.hashForUnknownUsers = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * @throws LoginThrottledException if there were too many recent failures
     * @throws BadCredentialsException if the credentials are not valid
     * @throws EmailNotVerifiedException if they are, but the owner of a signed-up firm has not verified
     *     the email yet: a new verification link is sent (ADR-0050)
     */
    LoginResult authenticate(LoginRequest request, String clientAddress) {
        String slug = request.tenant().strip().toLowerCase(Locale.ROOT);
        String email = UserService.normalizeEmail(request.email());
        String accountKey = slug + "|" + email;

        throttle.acquire(accountKey, clientAddress);
        AppUser user = verify(slug, email, request.password())
                .orElseThrow(() -> new BadCredentialsException("Invalid firm, email or password"));
        if (user.isEmailVerificationPending()) {
            // The attempt stays counted, so the throttle also limits how many links this can send.
            TenantContext.runAs(user.getTenantId(), () -> emailVerification.sendLink(user.getId()));
            throw new EmailNotVerifiedException();
        }
        Instant now = clock.instant();
        if (user.isTotpEnabled()) {
            return new LoginResult.SecondFactorRequired(new PendingSecondFactor(
                    user.getId(), user.getTenantId(), accountKey, now.plus(secondFactorTimeout)));
        }
        throttle.recordSuccess(accountKey, clientAddress);
        return new LoginResult.Authenticated(AuthenticatedUser.of(user, now));
    }

    /**
     * @throws SecondFactorExpiredException if the pending login is too old
     * @throws LoginThrottledException if there were too many recent failures
     * @throws InvalidSecondFactorException if the code is not accepted
     */
    AuthenticatedUser completeSecondFactor(PendingSecondFactor pending, String code, String clientAddress) {
        if (pending.isExpiredAt(clock.instant())) {
            throw new SecondFactorExpiredException();
        }
        throttle.acquire(pending.accountKey(), clientAddress);
        AppUser user = TenantContext.callAs(pending.tenantId(), () -> twoFactor.verifyLogin(pending.userId(), code))
                .orElseThrow(InvalidSecondFactorException::new);
        // Refunds this attempt and the one the password step kept; failed codes stay counted.
        throttle.recordSuccess(pending.accountKey(), clientAddress, 2);
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
