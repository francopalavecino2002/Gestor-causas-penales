package ar.gestorpenal.security;

import ar.gestorpenal.tenancy.TenantService.TenantSummary;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Opening the email verification link of a signed-up firm (ADR-0050). The SPA posts the secret from the
 * link's fragment, so a mail scanner that only fetches the link verifies nothing. Each attempt draws on
 * the login throttle, so guessing links costs the same budget as guessing passwords.
 */
@RestController
class EmailVerificationController {

    private final EmailVerificationService verification;
    private final LoginThrottle loginThrottle;

    EmailVerificationController(EmailVerificationService verification, LoginThrottle loginThrottle) {
        this.verification = verification;
        this.loginThrottle = loginThrottle;
    }

    record VerificationRequest(@NotBlank @Size(max = 64) String token) {

        @Override
        public String toString() {
            return "VerificationRequest[token=***]";
        }
    }

    /** {@code tenant} is the firm's slug, which the owner types at login as "estudio". */
    record VerifiedFirm(String tenant, String firmName) {}

    @PostMapping(SecurityConfig.EMAIL_VERIFICATION_PATH)
    VerifiedFirm verify(@Valid @RequestBody VerificationRequest body, HttpServletRequest request) {
        String accountKey = "verify-link|" + LinkSecrets.hash(body.token());
        String client = request.getRemoteAddr();
        loginThrottle.acquire(accountKey, client);
        TenantSummary firm = verification.verify(body.token());
        loginThrottle.recordSuccess(accountKey, client);
        return new VerifiedFirm(firm.slug(), firm.name());
    }
}
