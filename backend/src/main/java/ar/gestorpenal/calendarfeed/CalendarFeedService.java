package ar.gestorpenal.calendarfeed;

import ar.gestorpenal.hearing.HearingIcsExport;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Each member's private calendar feed (ADR-0034). The secret is 256 random bits, shown once when the
 * link is created and stored only as its SHA-256; a new link revokes the previous one.
 */
@Service
class CalendarFeedService {

    static final String FEED_PATH_PREFIX = "/api/v1/calendar-feed/";
    static final String FEED_PATH_SUFFIX = ".ics";

    private static final int SECRET_BYTES = 32;

    /** 32 bytes in unpadded base64url. Anything else cannot be a secret and is not looked up. */
    private static final Pattern SECRET_FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");

    private final CalendarFeedTokenRepository tokens;
    private final FeedTokenLookup lookup;
    private final UserRepository users;
    private final HearingIcsExport icsExport;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    CalendarFeedService(
            CalendarFeedTokenRepository tokens,
            FeedTokenLookup lookup,
            UserRepository users,
            HearingIcsExport icsExport,
            Clock clock) {
        this.tokens = tokens;
        this.lookup = lookup;
        this.users = users;
        this.icsExport = icsExport;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    FeedStatus status(AuthenticatedUser user) {
        return tokens.findByUserIdAndRevokedAtIsNull(user.userId())
                .map(token -> new FeedStatus(true, token.getCreatedAt()))
                .orElse(new FeedStatus(false, null));
    }

    /** A new link for the user; the previous one, if any, stops working at once. */
    @Transactional
    IssuedFeed issue(AuthenticatedUser user) {
        Instant now = clock.instant();
        revokeLive(user, now);
        // The live link must be revoked in the database before the new one is inserted (one live link per user).
        tokens.flush();
        String secret = newSecret();
        // Flushed here so a concurrent issue fails inside this call and answers 409, not at commit.
        tokens.saveAndFlush(new CalendarFeedToken(user.userId(), hash(secret), now));
        return new IssuedFeed(FEED_PATH_PREFIX + secret + FEED_PATH_SUFFIX, now);
    }

    @Transactional
    void revoke(AuthenticatedUser user) {
        revokeLive(user, clock.instant());
    }

    /**
     * The calendar behind a secret, or empty when the secret is unknown, revoked, or its owner or firm
     * is archived. Runs in the owner's firm and with the owner's current role, so the feed shows
     * exactly what the owner would see in the agenda. Must not be called inside a transaction.
     */
    Optional<String> calendarOf(String secret) {
        if (secret == null || !SECRET_FORMAT.matcher(secret).matches()) {
            return Optional.empty();
        }
        // The feed acts as its owner, but there is no login: "authenticated at" is simply now.
        return lookup.findLive(hash(secret)).flatMap(owner -> TenantContext.callAs(owner.tenantId(), () -> users
                .findById(owner.userId())
                .filter(AppUser::isActive)
                .map(member -> icsExport.feedOf(
                        new AuthenticatedUser(member.getId(), member.getTenantId(), member.getRole(), clock.instant())))));
    }

    private void revokeLive(AuthenticatedUser user, Instant now) {
        tokens.findByUserIdAndRevokedAtIsNull(user.userId()).ifPresent(token -> token.revoke(now));
    }

    private String newSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }

    /** Whether the user has a live link, and since when. The secret itself is never shown again. */
    record FeedStatus(boolean active, Instant createdAt) {}

    /** The new link, relative to the server: the client adds its own origin. */
    record IssuedFeed(String path, Instant createdAt) {}
}
