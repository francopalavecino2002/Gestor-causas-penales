package ar.gestorpenal.security;

import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The logged-in user changes their own password (ADR-0044), which is also how a temporary password
 * set by the owner is replaced. It draws on the login throttle like the two-factor changes, and it
 * ends every session of the user, this one included: they log in again with the new password.
 */
@RestController
class PasswordController {

    static final String PATH = "/api/v1/me/password";

    private final UserService users;
    private final LoginThrottle throttle;

    PasswordController(UserService users, LoginThrottle throttle) {
        this.users = users;
        this.throttle = throttle;
    }

    record PasswordChangeRequest(
            @NotBlank @Size(max = 128) String currentPassword, @NotBlank @Size(max = 128) String newPassword) {

        @Override
        public String toString() {
            return "PasswordChangeRequest[currentPassword=***, newPassword=***]";
        }
    }

    @PostMapping(PATH)
    ResponseEntity<Void> change(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody PasswordChangeRequest body,
            HttpServletRequest request) {
        String accountKey = "password|" + user.userId();
        String client = request.getRemoteAddr();
        throttle.acquire(accountKey, client);
        users.changeOwnPassword(user.userId(), body.currentPassword(), body.newPassword());
        throttle.recordSuccess(accountKey, client);

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.getContextHolderStrategy().clearContext();
        return ResponseEntity.noContent().build();
    }
}
