package ar.gestorpenal.security;

import ar.gestorpenal.mail.MailOutcome;
import ar.gestorpenal.mail.MailTemplate;
import ar.gestorpenal.mail.Mailer;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.tenancy.TenantService.TenantSummary;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Email verification of the owner of a firm that signed up by itself (ADR-0050). The link carries 256
 * random bits, is stored only as its SHA-256, works once, for {@code app.signup.verification-ttl}, and a
 * newer link revokes the previous one. Opening it lets the owner log in; it does not log them in.
 *
 * <p>Not transactional on purpose: each step enters the firm's {@link TenantContext} first.
 */
@Service
public class EmailVerificationService {

    static final MailTemplate TEMPLATE = new MailTemplate("email-verification", "Confirmá tu email para {{firmName}}");
    static final String VERIFY_PAGE = "/verificar-email";

    private final TenantService tenants;
    private final UserRepository users;
    private final EmailVerificationTokenRepository tokens;
    private final EmailVerificationTokenLookup lookup;
    private final Mailer mailer;
    private final Duration tokenTtl;
    private final String publicUrl;
    private final Clock clock;
    private final TransactionTemplate transaction;

    EmailVerificationService(
            TenantService tenants,
            UserRepository users,
            EmailVerificationTokenRepository tokens,
            EmailVerificationTokenLookup lookup,
            Mailer mailer,
            @Value("${app.signup.verification-ttl}") Duration tokenTtl,
            @Value("${app.public-url}") String publicUrl,
            Clock clock,
            PlatformTransactionManager transactionManager) {
        this.tenants = tenants;
        this.users = users;
        this.tokens = tokens;
        this.lookup = lookup;
        this.mailer = mailer;
        this.tokenTtl = tokenTtl;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
        this.clock = clock;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /**
     * Issues a new link for a user still pending verification, revoking the open ones, and emails it.
     * Call it inside the firm's {@link TenantContext} scope, outside any transaction (the email goes out
     * after the link is stored).
     */
    public MailOutcome sendLink(UUID userId) {
        AppUser user = users.findById(userId)
                .filter(AppUser::isActive)
                .filter(AppUser::isEmailVerificationPending)
                .orElseThrow(() -> new IllegalStateException("The user is not waiting for an email verification"));
        String slug = tenants.describe(user.getTenantId()).map(TenantSummary::slug).orElseThrow();
        String secret = transaction.execute(status -> issue(user.getId()));
        return mailer.send(TEMPLATE, user.getEmail(), Map.of(
                "displayName", user.getDisplayName(),
                "firmSlug", slug,
                "link", linkFor(slug, secret),
                "hours", String.valueOf(tokenTtl.toHours())));
    }

    /**
     * Marks the email of the link's owner as verified and uses the link up.
     *
     * @return the firm the owner can now log in to
     * @throws InvalidVerificationTokenException if the link is unknown, used, revoked, expired, or its
     *     user or firm was archived
     */
    TenantSummary verify(String secret) {
        if (!LinkSecrets.isWellFormed(secret)) {
            throw new InvalidVerificationTokenException();
        }
        String hash = LinkSecrets.hash(secret);
        UUID firm = lookup.findFirmOf(hash).orElseThrow(InvalidVerificationTokenException::new);
        TenantContext.runAs(firm, () -> transaction.executeWithoutResult(status -> {
            Instant now = clock.instant();
            EmailVerificationToken token = tokens.findByTokenHash(hash)
                    .filter(candidate -> candidate.isUsableAt(now))
                    .orElseThrow(InvalidVerificationTokenException::new);
            AppUser user = users.findById(token.getUserId())
                    .filter(AppUser::isActive)
                    .orElseThrow(InvalidVerificationTokenException::new);
            user.markEmailVerified();
            token.markUsed(now);
            revokeOpenLinks(user.getId(), now);
        }));
        return tenants.describe(firm).orElseThrow(InvalidVerificationTokenException::new);
    }

    /** Runs inside the firm's scope and a transaction. */
    private String issue(UUID userId) {
        Instant now = clock.instant();
        revokeOpenLinks(userId, now);
        String secret = LinkSecrets.newSecret();
        tokens.save(new EmailVerificationToken(userId, LinkSecrets.hash(secret), now, now.plus(tokenTtl)));
        return secret;
    }

    private void revokeOpenLinks(UUID userId, Instant now) {
        tokens.findByUserIdAndUsedAtIsNullAndRevokedAtIsNull(userId).forEach(open -> open.revoke(now));
    }

    /** The secret goes in the fragment, which browsers never send to a server nor in a Referer. */
    private String linkFor(String slug, String secret) {
        return publicUrl + VERIFY_PAGE + "?estudio=" + URLEncoder.encode(slug, StandardCharsets.UTF_8)
                + "#token=" + secret;
    }
}
