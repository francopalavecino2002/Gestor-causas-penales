package ar.gestorpenal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
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
 * Session login for the SPA (ADR-0008). Logout is handled by Spring Security's logout filter at
 * {@link SecurityConfig#LOGOUT_PATH}.
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

    /** Issues the {@code XSRF-TOKEN} cookie; the SPA echoes it in the {@code X-XSRF-TOKEN} header. */
    @GetMapping("/csrf")
    ResponseEntity<Void> csrf(CsrfToken token) {
        writeTokenCookie(token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    ResponseEntity<Void> login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        AuthenticatedUser user = loginService.authenticate(body, request.getRemoteAddr());
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities());

        sessionStrategy.onAuthentication(authentication, request, response);
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        if (request.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken rotated) {
            writeTokenCookie(rotated);
        }
        return ResponseEntity.noContent().build();
    }

    /** CSRF tokens are deferred: reading the value is what makes the repository write the cookie. */
    private static void writeTokenCookie(CsrfToken token) {
        token.getToken();
    }
}
