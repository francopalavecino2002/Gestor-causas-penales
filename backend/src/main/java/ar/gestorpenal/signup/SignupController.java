package ar.gestorpenal.signup;

import ar.gestorpenal.security.LoginThrottle;
import ar.gestorpenal.security.LoginThrottledException;
import ar.gestorpenal.security.SecurityConfig;
import ar.gestorpenal.signup.SignupService.SignedUp;
import ar.gestorpenal.signup.SignupService.SignupForm;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Probá gratis" (ADR-0050). The public settings tell the SPA whether to offer it; the sign-up itself
 * answers 404 while it is off, and 429 past its limits per email and per client address, which count
 * every request, honeypot ones included.
 */
@RestController
class SignupController {

    static final String SETTINGS_PATH = "/api/v1/public/signup";

    private final SignupService signups;
    private final SignupProperties properties;
    private final LoginThrottle throttle;
    private final Validator validator;

    SignupController(SignupService signups, SignupProperties properties, Validator validator, Clock clock) {
        this.signups = signups;
        this.properties = properties;
        this.validator = validator;
        // Its own counters: signing up must not lock anyone out of logging in, nor the reverse.
        this.throttle = new LoginThrottle(properties.requestLimits(), clock);
    }

    record AreaOption(String code, String name) {}

    record SignupSettings(boolean enabled, long trialDays, List<AreaOption> practiceAreas) {}

    /** {@code website} is the honeypot: hidden from people, so only a bot fills it. */
    record SignupRequest(
            @NotBlank @Size(max = 200) String firmName,
            @NotNull @Size(min = 1, max = 20) List<@NotBlank @Size(max = 50) String> practiceAreas,
            @NotBlank @Size(max = 200) String ownerName,
            @NotBlank @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String password,
            @Size(max = 500) String website) {

        @Override
        public String toString() {
            return "SignupRequest[firmName=" + firmName + ", password=***]";
        }
    }

    /** {@code tenant} is the slug the owner types as "estudio" at login. */
    record SignupResponse(String tenant, String email) {}

    @GetMapping(SETTINGS_PATH)
    SignupSettings settings() {
        if (!properties.enabled()) {
            return new SignupSettings(false, 0, List.of());
        }
        return new SignupSettings(true, properties.trialLength().toDays(), signups.availableAreas().stream()
                .map(area -> new AreaOption(area.code(), area.name()))
                .toList());
    }

    /** Validated by hand, after the switch: while sign-up is off, every body gets the same 404. */
    @PostMapping(SecurityConfig.SIGNUP_PATH)
    @ResponseStatus(HttpStatus.ACCEPTED)
    SignupResponse signUp(@RequestBody SignupRequest body, HttpServletRequest request) {
        if (!properties.enabled()) {
            throw new SignupDisabledException();
        }
        if (!validator.validate(body).isEmpty()) {
            throw new InvalidSignupException("A field is missing or too long");
        }
        try {
            throttle.acquire("signup|" + UserService.normalizeEmail(body.email()), request.getRemoteAddr());
        } catch (LoginThrottledException e) {
            throw new SignupThrottledException(e.retryAfterSeconds());
        }
        SignedUp signedUp = signups.signUp(new SignupForm(
                body.firmName(), body.practiceAreas(), body.ownerName(), body.email(), body.password(),
                body.website()));
        return new SignupResponse(signedUp.firmSlug(), signedUp.email());
    }
}
