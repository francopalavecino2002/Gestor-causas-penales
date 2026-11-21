package ar.gestorpenal.security;

import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * TOTP second factor and recovery codes (ADR-0009). Every method works on the current tenant, so the
 * caller must be authenticated or inside a {@code TenantContext} scope.
 *
 * <p>Codes are single use: a TOTP step is accepted once per user and a recovery code is marked used,
 * both through conditional updates that are safe under concurrent requests.
 */
@Service
class TwoFactorService {

    static final String ISSUER = "Gestor Penal";
    static final int RECOVERY_CODE_COUNT = 10;

    /** Crockford's base32: no I, L, O or U, so codes are easy to read aloud and to type. */
    private static final String RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    /** 16 characters of 5 bits: 80 random bits, out of reach of offline guessing of the hash. */
    private static final int RECOVERY_CODE_LENGTH = 16;
    private static final int RECOVERY_GROUP = 4;

    private final UserRepository users;
    private final RecoveryCodeRepository recoveryCodes;
    private final TotpSecretCipher cipher;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    TwoFactorService(
            UserRepository users,
            RecoveryCodeRepository recoveryCodes,
            TotpSecretCipher cipher,
            PasswordEncoder passwordEncoder,
            Clock clock) {
        this.users = users;
        this.recoveryCodes = recoveryCodes;
        this.cipher = cipher;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    record Status(boolean enabled, long recoveryCodesRemaining) {}

    /** What the user needs to add the account to an authenticator app. */
    record Enrollment(String secret, String otpauthUri) {}

    @Transactional(readOnly = true)
    Status status(UUID userId) {
        AppUser user = activeUser(userId);
        return user.isTotpEnabled()
                ? new Status(true, recoveryCodes.countUsable(userId))
                : new Status(false, 0);
    }

    /**
     * Generates a new secret. Two-factor stays off until {@link #confirmEnrollment} receives a valid
     * code, so a user who never finishes is not locked out. Starting again replaces the secret.
     */
    @Transactional
    Enrollment startEnrollment(UUID userId, String password) {
        AppUser user = activeUser(userId);
        requirePassword(user, password);
        if (user.isTotpEnabled()) {
            throw new TwoFactorStateException("Two-factor authentication is already enabled.");
        }
        byte[] secret = new byte[Totp.SECRET_BYTES];
        random.nextBytes(secret);
        user.startTotpEnrollment(cipher.encrypt(secret, userId));
        String base32 = Base32.encode(secret);
        return new Enrollment(base32, otpauthUri(user.getEmail(), base32));
    }

    /**
     * Turns two-factor on if {@code code} comes from the secret being enrolled.
     *
     * @return the recovery codes, in clear text for the only time
     */
    @Transactional
    List<String> confirmEnrollment(UUID userId, String code) {
        AppUser user = activeUser(userId);
        if (user.isTotpEnabled() || user.getTotpSecret() == null) {
            throw new TwoFactorStateException("There is no two-factor enrollment in progress.");
        }
        if (!acceptTotp(user, code)) {
            throw new TwoFactorConfirmationException();
        }
        activeUser(userId).enableTotp(clock.instant());
        return issueRecoveryCodes(userId);
    }

    /**
     * Second step of the login: a TOTP code or an unused recovery code.
     *
     * @return the user, if they are active, have two-factor on and the code is accepted
     */
    @Transactional
    Optional<AppUser> verifyLogin(UUID userId, String code) {
        return users.findById(userId)
                .filter(AppUser::isActive)
                .filter(AppUser::isTotpEnabled)
                .filter(user -> acceptSecondFactor(user, code));
    }

    /**
     * Replaces every recovery code. Needs a current second factor, so a stolen session alone cannot
     * read new codes.
     */
    @Transactional
    List<String> regenerateRecoveryCodes(UUID userId, String code) {
        requireSecondFactor(activeUser(userId), code);
        return issueRecoveryCodes(userId);
    }

    /** Needs the password and a second factor; archives the recovery codes. */
    @Transactional
    void disable(UUID userId, String password, String code) {
        AppUser user = activeUser(userId);
        requirePassword(user, password);
        requireSecondFactor(user, code);
        activeUser(userId).disableTotp();
        recoveryCodes.archiveAll(userId, clock.instant());
    }

    private void requirePassword(AppUser user, String password) {
        if (!UserService.fitsPasswordHash(password) || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new TwoFactorConfirmationException();
        }
    }

    private void requireSecondFactor(AppUser user, String code) {
        if (!user.isTotpEnabled()) {
            throw new TwoFactorStateException("Two-factor authentication is not enabled.");
        }
        if (!acceptSecondFactor(user, code)) {
            throw new TwoFactorConfirmationException();
        }
    }

    private boolean acceptSecondFactor(AppUser user, String code) {
        String trimmed = code.strip();
        if (trimmed.length() == Totp.DIGITS) {
            return acceptTotp(user, trimmed);
        }
        return normalizeRecoveryCode(trimmed)
                .map(normalized -> recoveryCodes.consume(user.getId(), sha256(normalized), clock.instant()) == 1)
                .orElse(false);
    }

    /**
     * Checks the code and records its step in one conditional update, so it cannot be replayed.
     * The update clears the persistence context: callers must reload the user before changing it.
     */
    private boolean acceptTotp(AppUser user, String code) {
        byte[] secret = cipher.decrypt(user.getTotpSecret(), user.getId());
        OptionalLong step = Totp.matchingStep(secret, code.strip(), clock.instant());
        return step.isPresent() && users.advanceTotpStep(user.getId(), step.getAsLong()) == 1;
    }

    private List<String> issueRecoveryCodes(UUID userId) {
        Instant now = clock.instant();
        recoveryCodes.archiveAll(userId, now);
        List<String> codes = new ArrayList<>(RECOVERY_CODE_COUNT);
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            String raw = randomRecoveryCode();
            recoveryCodes.save(new RecoveryCode(userId, sha256(raw), now));
            codes.add(formatRecoveryCode(raw));
        }
        return codes;
    }

    private String randomRecoveryCode() {
        StringBuilder code = new StringBuilder(RECOVERY_CODE_LENGTH);
        for (int i = 0; i < RECOVERY_CODE_LENGTH; i++) {
            code.append(RECOVERY_ALPHABET.charAt(random.nextInt(RECOVERY_ALPHABET.length())));
        }
        return code.toString();
    }

    /** {@code ABCD1234EFGH5678} is shown as {@code ABCD-1234-EFGH-5678}. */
    private static String formatRecoveryCode(String raw) {
        StringBuilder formatted = new StringBuilder();
        for (int i = 0; i < raw.length(); i += RECOVERY_GROUP) {
            if (i > 0) {
                formatted.append('-');
            }
            formatted.append(raw, i, i + RECOVERY_GROUP);
        }
        return formatted.toString();
    }

    /**
     * Accepts the code as the user may type it: any case, with or without dashes and spaces, and
     * with the letters Crockford's base32 maps to digits (O to 0, I and L to 1).
     */
    static Optional<String> normalizeRecoveryCode(String typed) {
        String normalized = typed.replace("-", "").replace(" ", "").toUpperCase(Locale.ROOT)
                .replace('O', '0').replace('I', '1').replace('L', '1');
        if (normalized.length() != RECOVERY_CODE_LENGTH
                || !normalized.chars().allMatch(c -> RECOVERY_ALPHABET.indexOf(c) >= 0)) {
            return Optional.empty();
        }
        return Optional.of(normalized);
    }

    private AppUser activeUser(UUID userId) {
        return users.findById(userId)
                .filter(AppUser::isActive)
                .orElseThrow(() -> new InsufficientAuthenticationException("The user is no longer active"));
    }

    /** Key URI format understood by authenticator apps; the issuer prefix labels the account. */
    private static String otpauthUri(String email, String base32Secret) {
        String label = encode(ISSUER) + ":" + encode(email);
        return "otpauth://totp/" + label
                + "?secret=" + base32Secret
                + "&issuer=" + encode(ISSUER)
                + "&algorithm=SHA1&digits=" + Totp.DIGITS + "&period=" + Totp.STEP_SECONDS;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }
}
