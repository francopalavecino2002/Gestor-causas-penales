package ar.gestorpenal.security;

import ar.gestorpenal.mail.MailTemplate;
import ar.gestorpenal.mail.Mailer;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import jakarta.annotation.PreDestroy;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Password recovery by email (ADR-0049).
 *
 * <p>Asking for a link answers at once and the same way whether or not the account exists: the lookup
 * and the email happen afterwards on a single background thread, so neither the answer nor its timing
 * tells an anonymous visitor which accounts exist. The link carries 256 random bits, is stored only as
 * its SHA-256, works once, for {@link PasswordResetProperties#tokenTtl()}, and asking again revokes the
 * previous one.
 *
 * <p>Using the link sets the new password and ends every session of the user; it does not log them in,
 * so the next login still asks for the second factor when they have one.
 *
 * <p>Not transactional on purpose: each step enters the firm's {@link TenantContext} first.
 */
@Service
class PasswordResetService {

    static final MailTemplate TEMPLATE = new MailTemplate("password-reset", "Restablecé tu contraseña de {{firmName}}");
    static final String RESET_PAGE = "/restablecer-clave";

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int MAX_QUEUED_REQUESTS = 100;

    private final TenantService tenants;
    private final UserRepository users;
    private final UserService userService;
    private final PasswordResetTokenRepository tokens;
    private final PasswordResetTokenLookup lookup;
    private final Mailer mailer;
    private final PasswordResetProperties properties;
    private final String publicUrl;
    private final Clock clock;
    private final TransactionTemplate transaction;
    private final ExecutorService background = new ThreadPoolExecutor(
            1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(MAX_QUEUED_REQUESTS),
            runnable -> {
                Thread thread = new Thread(runnable, "password-reset");
                thread.setDaemon(true);
                return thread;
            },
            (runnable, executor) -> log.warn("Password reset request dropped: the queue is full"));

    PasswordResetService(
            TenantService tenants,
            UserRepository users,
            UserService userService,
            PasswordResetTokenRepository tokens,
            PasswordResetTokenLookup lookup,
            Mailer mailer,
            PasswordResetProperties properties,
            @Value("${app.public-url}") String publicUrl,
            Clock clock,
            PlatformTransactionManager transactionManager) {
        this.tenants = tenants;
        this.users = users;
        this.userService = userService;
        this.tokens = tokens;
        this.lookup = lookup;
        this.mailer = mailer;
        this.properties = properties;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
        this.clock = clock;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /** Queues the request and returns at once; see the class comment. */
    void requestLink(String firmSlug, String email) {
        String slug = firmSlug.strip().toLowerCase(Locale.ROOT);
        String normalizedEmail = UserService.normalizeEmail(email);
        background.execute(() -> {
            try {
                sendLinkIfTheAccountExists(slug, normalizedEmail);
            } catch (RuntimeException e) {
                log.warn("Password reset request failed: {}", e.getClass().getName());
            }
        });
    }

    /** The work behind {@link #requestLink}; package-private so tests can run it on their own thread. */
    void sendLinkIfTheAccountExists(String slug, String email) {
        Optional<UUID> firm = tenants.findActiveIdBySlug(slug);
        if (firm.isEmpty()) {
            return;
        }
        TenantContext.runAs(firm.get(), () -> users.findByEmail(email).filter(AppUser::isActive).ifPresent(user -> {
            String secret = transaction.execute(status -> issue(user.getId()));
            mailer.send(TEMPLATE, user.getEmail(), Map.of(
                    "displayName", user.getDisplayName(),
                    "link", linkFor(slug, secret),
                    "minutes", String.valueOf(properties.tokenTtl().toMinutes())));
        }));
    }

    /**
     * Sets {@code newPassword} for the owner of the link and uses the link up.
     *
     * @throws InvalidResetTokenException if the link is unknown, used, revoked, expired, or its user or
     *     firm was archived
     * @throws ar.gestorpenal.user.InvalidPasswordException if the new password is not acceptable; the
     *     link stays usable
     */
    void resetPassword(String secret, String newPassword) {
        if (!LinkSecrets.isWellFormed(secret)) {
            throw new InvalidResetTokenException();
        }
        String hash = hash(secret);
        UUID firm = lookup.findFirmOf(hash).orElseThrow(InvalidResetTokenException::new);
        TenantContext.runAs(firm, () -> transaction.executeWithoutResult(status -> {
            Instant now = clock.instant();
            PasswordResetToken token = tokens.findByTokenHash(hash)
                    .filter(candidate -> candidate.isUsableAt(now))
                    .orElseThrow(InvalidResetTokenException::new);
            if (!userService.resetForgottenPassword(token.getUserId(), newPassword)) {
                throw new InvalidResetTokenException();
            }
            token.markUsed(now);
            revokeOpenLinks(token.getUserId(), now);
        }));
    }

    /** Runs inside the firm's scope and a transaction: a new link revokes the open ones. */
    private String issue(UUID userId) {
        Instant now = clock.instant();
        revokeOpenLinks(userId, now);
        String secret = LinkSecrets.newSecret();
        tokens.save(new PasswordResetToken(userId, hash(secret), now, now.plus(properties.tokenTtl())));
        return secret;
    }

    private void revokeOpenLinks(UUID userId, Instant now) {
        tokens.findByUserIdAndUsedAtIsNullAndRevokedAtIsNull(userId).forEach(open -> open.revoke(now));
    }

    /** The secret goes in the fragment, which browsers never send to a server nor in a Referer. */
    private String linkFor(String slug, String secret) {
        return publicUrl + RESET_PAGE + "?estudio=" + URLEncoder.encode(slug, StandardCharsets.UTF_8)
                + "#token=" + secret;
    }

    static String hash(String secret) {
        return LinkSecrets.hash(secret);
    }

    @PreDestroy
    void stop() {
        background.shutdown();
    }
}
