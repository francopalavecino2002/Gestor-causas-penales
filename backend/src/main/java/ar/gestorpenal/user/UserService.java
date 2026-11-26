package ar.gestorpenal.user;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates users of the current firm and changes their passwords. The caller must already be inside
 * a tenant (an authenticated request or a {@code TenantContext} scope); the tenant is stamped by
 * Hibernate.
 */
@Service
public class UserService {

    /** Counted in characters, while the maximum is in bytes because that is bcrypt's limit. */
    public static final int MIN_PASSWORD_LENGTH = 12;

    /** bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of truncated. */
    public static final int MAX_PASSWORD_BYTES = 72;

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final TemporaryPasswords temporaryPasswords = new TemporaryPasswords();

    UserService(UserRepository users, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /** A new user and the temporary password that is shown once to the owner who created them. */
    public record CreatedUser(AppUser user, String temporaryPassword) {

        @Override
        public String toString() {
            return "CreatedUser[userId=" + user.getId() + ", temporaryPassword=***]";
        }
    }

    /** Creates a user whose first action must be choosing their own password (ADR-0044). */
    @Transactional
    public CreatedUser createWithTemporaryPassword(String email, String displayName, Role role) {
        String temporaryPassword = temporaryPasswords.next();
        AppUser user = newUser(email, displayName, temporaryPassword, role);
        // Before saving, so the history shows one creation and no follow-up update.
        user.replacePassword(user.getPasswordHash(), true, clock.instant());
        return new CreatedUser(users.save(user), temporaryPassword);
    }

    /** Gives the user a new temporary password and ends their sessions; returns it to show once. */
    @Transactional
    public String resetToTemporaryPassword(AppUser user) {
        String temporaryPassword = temporaryPasswords.next();
        user.replacePassword(passwordEncoder.encode(temporaryPassword), true, clock.instant());
        return temporaryPassword;
    }

    /**
     * The user replaces their own password, proving they know the current one. Every session of the
     * user, the current one included, ends: they log in again with the new password.
     *
     * @throws WrongPasswordException if {@code currentPassword} does not match
     * @throws InvalidPasswordException if the new password is too short, too long or the same
     */
    @Transactional
    public void changeOwnPassword(UUID userId, String currentPassword, String newPassword) {
        AppUser user = users.findById(userId).filter(AppUser::isActive).orElseThrow(WrongPasswordException::new);
        if (!fitsPasswordHash(currentPassword) || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new WrongPasswordException();
        }
        try {
            requireAcceptablePassword(newPassword);
        } catch (IllegalArgumentException e) {
            throw new InvalidPasswordException(e.getMessage());
        }
        if (newPassword.equals(currentPassword)) {
            throw new InvalidPasswordException("The new password must be different from the current one");
        }
        user.replacePassword(passwordEncoder.encode(newPassword), false, clock.instant());
    }

    @Transactional
    public AppUser createUser(String email, String displayName, String rawPassword, Role role) {
        return users.save(newUser(email, displayName, rawPassword, role));
    }

    private AppUser newUser(String email, String displayName, String rawPassword, Role role) {
        requireAcceptablePassword(rawPassword);
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.length() > 254 || normalizedEmail.indexOf('@') < 1) {
            throw new IllegalArgumentException("Email is not valid");
        }
        String name = displayName.strip();
        if (name.isEmpty() || name.length() > 200) {
            throw new IllegalArgumentException("Display name must have between 1 and 200 characters");
        }
        return new AppUser(normalizedEmail, name, passwordEncoder.encode(rawPassword), role);
    }

    public static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    public static boolean fitsPasswordHash(String rawPassword) {
        return rawPassword.getBytes(StandardCharsets.UTF_8).length <= MAX_PASSWORD_BYTES;
    }

    static void requireAcceptablePassword(String rawPassword) {
        if (rawPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException(
                    "Password must have at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (!fitsPasswordHash(rawPassword)) {
            throw new IllegalArgumentException(
                    "Password must not exceed " + MAX_PASSWORD_BYTES + " bytes in UTF-8");
        }
    }
}
