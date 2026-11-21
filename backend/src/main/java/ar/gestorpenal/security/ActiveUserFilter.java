package ar.gestorpenal.security;

import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Re-validates the session's user on every request (ADR-0008). If the user was archived, their role
 * changed, or the session is older than its absolute lifetime, the session is invalidated and the
 * request continues as anonymous, so protected endpoints answer 401.
 *
 * <p>Built in {@link SecurityConfig}, not a {@code @Component}, so Spring Boot does not also register
 * it as a plain servlet filter.
 */
class ActiveUserFilter extends OncePerRequestFilter {

    private final UserRepository users;
    private final Clock clock;
    private final Duration maxSessionAge;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    ActiveUserFilter(UserRepository users, Clock clock, Duration maxSessionAge) {
        this.users = users;
        this.clock = clock;
        this.maxSessionAge = maxSessionAge;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = contextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AuthenticatedUser principal
                && !isStillValid(principal)) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            contextHolder.clearContext();
        }
        chain.doFilter(request, response);
    }

    /** The lookup is tenant-scoped through the principal itself (ADR-0007). */
    private boolean isStillValid(AuthenticatedUser principal) {
        if (clock.instant().isAfter(principal.authenticatedAt().plus(maxSessionAge))) {
            return false;
        }
        return users.findById(principal.userId())
                .filter(AppUser::isActive)
                .map(user -> user.getRole() == principal.role())
                .orElse(false);
    }
}
