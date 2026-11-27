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
import java.util.Arrays;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Re-validates the session's user on every request (ADR-0008). If the user was archived, their role
 * or password changed, or the session is older than its absolute lifetime, the session is
 * invalidated and the request continues as anonymous, so protected endpoints answer 401. A user who
 * still has a temporary password may only change it (ADR-0044).
 *
 * <p>Built in {@link SecurityConfig}, not a {@code @Component}, so Spring Boot does not also register
 * it as a plain servlet filter.
 */
class ActiveUserFilter extends OncePerRequestFilter {

    private static final String ME_PATH = "/api/v1/me";
    private static final String PUBLIC_PREFIX = "/api/v1/public/";
    private static final String CALENDAR_FEED_PREFIX = "/api/v1/calendar-feed/";

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
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            Optional<AppUser> user = stillValidUser(principal);
            if (user.isEmpty()) {
                HttpSession session = request.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
                contextHolder.clearContext();
            } else if (user.get().isPasswordChangeRequired() && !allowedWithTemporaryPassword(request)) {
                // Thrown after ExceptionTranslationFilter, so it becomes a 403 problem+json.
                throw new PasswordChangeRequiredException();
            }
        }
        chain.doFilter(request, response);
    }

    /**
     * The user behind the session, unless the session expired or the user was archived, changed
     * role or changed password since. The lookup is tenant-scoped through the principal (ADR-0007).
     */
    private Optional<AppUser> stillValidUser(AuthenticatedUser principal) {
        if (clock.instant().isAfter(principal.authenticatedAt().plus(maxSessionAge))) {
            return Optional.empty();
        }
        return users.findById(principal.userId())
                .filter(AppUser::isActive)
                .filter(user -> user.getRole() == principal.role())
                .filter(user -> !user.credentialsChangedAfter(principal.authenticatedAt()));
    }

    /**
     * With a temporary password the SPA may only read who is logged in and change the password; the
     * public endpoints and a new login stay reachable too. Exact matches on the raw path, so any
     * variant (trailing slash, encoding) is refused: the check fails closed. The two public prefixes
     * also refuse any dot segment, encoding or empty segment themselves, without relying on the
     * firewall. Logout is served by Spring Security's logout filter, before this one.
     */
    static boolean allowedWithTemporaryPassword(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return switch (request.getMethod()) {
            case "GET" -> ME_PATH.equals(path)
                    || SecurityConfig.CSRF_PATH.equals(path)
                    || plainPathUnder(PUBLIC_PREFIX, path)
                    || plainPathUnder(CALENDAR_FEED_PREFIX, path);
            case "POST" -> PasswordController.PATH.equals(path)
                    || SecurityConfig.LOGIN_PATH.equals(path)
                    || SecurityConfig.SECOND_FACTOR_PATH.equals(path);
            default -> false;
        };
    }

    private static boolean plainPathUnder(String prefix, String path) {
        if (!path.startsWith(prefix)) {
            return false;
        }
        String rest = path.substring(prefix.length());
        return rest.chars().noneMatch(c -> c == '%' || c == ';' || c == '\\')
                && Arrays.stream(rest.split("/", -1))
                        .noneMatch(segment -> segment.isEmpty() || segment.equals(".") || segment.equals(".."));
    }
}
