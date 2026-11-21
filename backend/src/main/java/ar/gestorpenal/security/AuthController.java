package ar.gestorpenal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session login for the SPA (ADR-0008), in two steps when the user has two-factor on (ADR-0009).
 * Logout is handled by Spring Security's logout filter at {@link SecurityConfig#LOGOUT_PATH}.
 */
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    private final LoginService loginService;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    AuthController(
            LoginService loginService,
            SecurityContextRepository securityContextRepository,
            CsrfTokenRepository csrfTokenRepository) {
        this.loginService = loginService;
        this.securityContextRepository = securityContextRepository;
        // New session id against session fixation, new CSRF token so a pre-login token is useless.
        this.sessionStrategy = new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(csrfTokenRepository)));
    }

    /** Body of a 202 login: the SPA must ask for the code and call the second-factor endpoint. */
    record LoginStatus(String status) {
        static final LoginStatus SECOND_FACTOR_REQUIRED = new LoginStatus("SECOND_FACTOR_REQUIRED");
    }

    /** Issues the {@code XSRF-TOKEN} cookie; the SPA echoes it in the {@code X-XSRF-TOKEN} header. */
    @GetMapping("/csrf")
    ResponseEntity<Void> csrf(CsrfToken token) {
        writeTokenCookie(token);
        return ResponseEntity.noContent().build();
    }

    /** 204 when the user is in; 202 with {@link LoginStatus} when a second factor is needed. */
    @PostMapping("/login")
    ResponseEntity<LoginStatus> login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        return switch (loginService.authenticate(body, request.getRemoteAddr())) {
            case LoginResult.Authenticated authenticated -> {
                establishSession(authenticated.user(), request, response);
                yield ResponseEntity.noContent().build();
            }
            case LoginResult.SecondFactorRequired required -> {
                startPendingSession(required.pending(), request);
                yield ResponseEntity.status(HttpStatus.ACCEPTED).body(LoginStatus.SECOND_FACTOR_REQUIRED);
            }
        };
    }

    @PostMapping("/login/second-factor")
    ResponseEntity<Void> secondFactor(
            @Valid @RequestBody CodeRequest body, HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session == null
                || !(session.getAttribute(PendingSecondFactor.SESSION_ATTRIBUTE) instanceof PendingSecondFactor pending)) {
            throw new SecondFactorExpiredException();
        }
        AuthenticatedUser user;
        try {
            user = loginService.completeSecondFactor(pending, body.code(), request.getRemoteAddr());
        } catch (SecondFactorExpiredException e) {
            session.removeAttribute(PendingSecondFactor.SESSION_ATTRIBUTE);
            throw e;
        }
        establishSession(user, request, response);
        return ResponseEntity.noContent().build();
    }

    private void establishSession(AuthenticatedUser user, HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities());

        sessionStrategy.onAuthentication(authentication, request, response);
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        request.getSession().removeAttribute(PendingSecondFactor.SESSION_ATTRIBUTE);

        if (request.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken rotated) {
            writeTokenCookie(rotated);
        }
    }

    /**
     * A fresh session that holds only the pending login: whoever was logged in before in this
     * browser is logged out, so the half-done login never runs with someone else's context.
     */
    private void startPendingSession(PendingSecondFactor pending, HttpServletRequest request) {
        HttpSession previous = request.getSession(false);
        if (previous != null) {
            previous.invalidate();
        }
        contextHolder.clearContext();
        request.getSession(true).setAttribute(PendingSecondFactor.SESSION_ATTRIBUTE, pending);
    }

    /** CSRF tokens are deferred: reading the value is what makes the repository write the cookie. */
    private static void writeTokenCookie(CsrfToken token) {
        token.getToken();
    }
}
