package ar.gestorpenal.user;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates users of the current firm. The caller must already be inside a tenant (an authenticated
 * request or a {@code TenantContext} scope); the tenant is stamped by Hibernate.
 */
@Service
public class UserService {

    /** Counted in characters, while the maximum is in bytes because that is bcrypt's limit. */
    public static final int MIN_PASSWORD_LENGTH = 12;

    /** bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of truncated. */
    public static final int MAX_PASSWORD_BYTES = 72;

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    UserService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AppUser createUser(String email, String displayName, String rawPassword, Role role) {
        requireAcceptablePassword(rawPassword);
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail.length() > 254 || normalizedEmail.indexOf('@') < 1) {
            throw new IllegalArgumentException("Email is not valid");
        }
        String name = displayName.strip();
        if (name.isEmpty() || name.length() > 200) {
            throw new IllegalArgumentException("Display name must have between 1 and 200 characters");
        }
        return users.save(new AppUser(normalizedEmail, name, passwordEncoder.encode(rawPassword), role));
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
