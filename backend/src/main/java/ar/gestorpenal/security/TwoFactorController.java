package ar.gestorpenal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Two-factor settings of the logged-in user (ADR-0009). Every change needs the password or a code,
 * and every check draws on the login throttle, so a stolen session cannot enroll another phone,
 * read new recovery codes or turn two-factor off.
 */
@RestController
@RequestMapping("/api/v1/me/two-factor")
class TwoFactorController {

    private final TwoFactorService twoFactor;
    private final LoginThrottle throttle;

    TwoFactorController(TwoFactorService twoFactor, LoginThrottle throttle) {
        this.twoFactor = twoFactor;
        this.throttle = throttle;
    }

    record PasswordRequest(@NotBlank @Size(max = 128) String password) {

        @Override
        public String toString() {
            return "PasswordRequest[password=***]";
        }
    }

    record DisableRequest(@NotBlank @Size(max = 128) String password, @NotBlank @Size(max = 32) String code) {

        @Override
        public String toString() {
            return "DisableRequest[password=***, code=***]";
        }
    }

    /** Shown once: the client must ask the user to store them before leaving the screen. */
    record RecoveryCodes(List<String> recoveryCodes) {}

    @GetMapping
    TwoFactorService.Status status(@AuthenticationPrincipal AuthenticatedUser user) {
        return twoFactor.status(user.userId());
    }

    /** Needs the password, so a stolen session cannot bind the account to the attacker's phone. */
    @PostMapping("/enrollment")
    TwoFactorService.Enrollment startEnrollment(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody PasswordRequest body,
            HttpServletRequest request) {
        return throttled(user, request, () -> twoFactor.startEnrollment(user.userId(), body.password()));
    }

    @PostMapping("/enrollment/confirm")
    RecoveryCodes confirmEnrollment(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CodeRequest body,
            HttpServletRequest request) {
        return throttled(user, request, () -> new RecoveryCodes(twoFactor.confirmEnrollment(user.userId(), body.code())));
    }

    @PostMapping("/recovery-codes")
    RecoveryCodes regenerateRecoveryCodes(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CodeRequest body,
            HttpServletRequest request) {
        return throttled(user, request,
                () -> new RecoveryCodes(twoFactor.regenerateRecoveryCodes(user.userId(), body.code())));
    }

    @PostMapping("/disable")
    ResponseEntity<Void> disable(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody DisableRequest body,
            HttpServletRequest request) {
        throttled(user, request, () -> {
            twoFactor.disable(user.userId(), body.password(), body.code());
            return null;
        });
        return ResponseEntity.noContent().build();
    }

    /** Reserves an attempt; only a successful action gives it back. */
    private <T> T throttled(AuthenticatedUser user, HttpServletRequest request, Supplier<T> action) {
        String accountKey = "two-factor|" + user.userId();
        String client = request.getRemoteAddr();
        throttle.acquire(accountKey, client);
        T result = action.get();
        throttle.recordSuccess(accountKey, client);
        return result;
    }
}
