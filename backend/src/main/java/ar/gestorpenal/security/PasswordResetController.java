package ar.gestorpenal.security;

import ar.gestorpenal.user.InvalidPasswordException;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * "¿Olvidaste tu contraseña?" (ADR-0049). Asking for a link always answers 202, whether or not the
 * account exists; only its request limits per account and per client address can answer 429, and
 * they count every request alike. Using a link draws on the login throttle (and can answer 429 from
 * it), so guessing links costs the same budget as guessing passwords.
 */
@RestController
class PasswordResetController {

    private final PasswordResetService resets;
    private final LoginThrottle loginThrottle;
    private final LoginThrottle requestThrottle;

    PasswordResetController(
            PasswordResetService resets,
            LoginThrottle loginThrottle,
            PasswordResetProperties properties,
            Clock clock) {
        this.resets = resets;
        this.loginThrottle = loginThrottle;
        // Its own counters: asking for links must not lock anyone out of logging in, nor the reverse.
        this.requestThrottle = new LoginThrottle(properties.requestLimits(), clock);
    }

    /** {@code tenant} is the firm's slug, shown to users as "estudio". */
    record ResetLinkRequest(@NotBlank @Size(max = 63) String tenant, @NotBlank @Size(max = 254) String email) {}

    record NewPasswordRequest(@NotBlank @Size(max = 64) String token, @NotBlank @Size(max = 128) String newPassword) {

        @Override
        public String toString() {
            return "NewPasswordRequest[token=***, newPassword=***]";
        }
    }

    @PostMapping(SecurityConfig.PASSWORD_RESET_PATH)
    ResponseEntity<Void> requestLink(@Valid @RequestBody ResetLinkRequest body, HttpServletRequest request) {
        String accountKey = "reset|" + body.tenant().strip().toLowerCase(Locale.ROOT) + "|"
                + UserService.normalizeEmail(body.email());
        try {
            requestThrottle.acquire(accountKey, request.getRemoteAddr());
        } catch (LoginThrottledException e) {
            throw new PasswordResetThrottledException(Duration.ofSeconds(e.retryAfterSeconds()));
        }
        resets.requestLink(body.tenant(), body.email());
        return ResponseEntity.accepted().build();
    }

    /** Sets the new password and closes every session of the user, this browser's included. */
    @PostMapping(SecurityConfig.PASSWORD_RESET_CONFIRM_PATH)
    ResponseEntity<Void> resetPassword(@Valid @RequestBody NewPasswordRequest body, HttpServletRequest request) {
        String accountKey = "reset-link|" + PasswordResetService.hash(body.token());
        String client = request.getRemoteAddr();
        loginThrottle.acquire(accountKey, client);
        try {
            resets.resetPassword(body.token(), body.newPassword());
        } catch (InvalidPasswordException e) {
            // Only reached with a usable link: a too-short password is not a guess, so it costs nothing.
            loginThrottle.recordSuccess(accountKey, client);
            throw e;
        }
        loginThrottle.recordSuccess(accountKey, client);

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.getContextHolderStrategy().clearContext();
        return ResponseEntity.noContent().build();
    }
}
