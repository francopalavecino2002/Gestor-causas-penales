package ar.gestorpenal.security;

import ar.gestorpenal.user.UserRepository;
import jakarta.servlet.DispatcherType;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Cookie session + CSRF for the same-origin SPA (ADR-0008). Deny by default: only the health
 * check, the CSRF bootstrap, the two login steps (ADR-0009), the calendar feed (ADR-0034) and the
 * read-only public deadline calculator (ADR-0041) and the built frontend (ADR-0046) are public.
 * There is no CORS configuration on purpose: the SPA and the API share one origin, so a browser on
 * any other origin gets no {@code Access-Control-Allow-*} header (ADR-0046).
 */
@Configuration
@EnableConfigurationProperties(LoginThrottleProperties.class)
public class SecurityConfig {

    static final String LOGIN_PATH = "/api/v1/auth/login";
    static final String SECOND_FACTOR_PATH = "/api/v1/auth/login/second-factor";
    static final String CSRF_PATH = "/api/v1/auth/csrf";
    static final String LOGOUT_PATH = "/api/v1/auth/logout";
    static final String CALENDAR_FEED_PATTERN = "/api/v1/calendar-feed/*.ics";
    static final String PUBLIC_API_PATTERN = "/api/v1/public/**";

    /** Only when there is a web server: the first-firm bootstrap (T66) runs without one. */
    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            CsrfTokenRepository csrfTokenRepository,
            SecurityContextRepository securityContextRepository,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver problemResolver,
            UserRepository users,
            Clock clock,
            @Value("${app.security.session.max-age}") Duration maxSessionAge)
            throws Exception {
        http
                .addFilterBefore(new ActiveUserFilter(users, clock, maxSessionAge), AuthorizationFilter.class)
                .csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokenRepository))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                // Filter-level errors reach SecurityProblemHandler, so they are problem+json too.
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, e) ->
                                problemResolver.resolveException(request, response, null, e))
                        .accessDeniedHandler((request, response, e) ->
                                problemResolver.resolveException(request, response, null, e)))
                .logout(logout -> logout
                        .logoutUrl(LOGOUT_PATH)
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .authorizeHttpRequests(auth -> auth
                        // Keeps the real status of errors instead of turning them into 401.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, CSRF_PATH).permitAll()
                        .requestMatchers(HttpMethod.POST, LOGIN_PATH, SECOND_FACTOR_PATH).permitAll()
                        // Calendar apps cannot log in: the secret in the path is the credential (ADR-0034).
                        .requestMatchers(HttpMethod.GET, CALENDAR_FEED_PATTERN).permitAll()
                        .requestMatchers(HttpMethod.HEAD, CALENDAR_FEED_PATTERN).permitAll()
                        // The public deadline calculator: read only and rate-limited (ADR-0041).
                        .requestMatchers(HttpMethod.GET, PUBLIC_API_PATTERN).permitAll()
                        // The built frontend (ADR-0046) is public code; the data behind /api is not.
                        .requestMatchers(frontendRequests()).permitAll()
                        .anyRequest().authenticated());
        return http.build();
    }

    /**
     * Reads (GET, HEAD) of anything outside {@code /api} and {@code /actuator}: the frontend's files
     * and client routes, served by the backend in production. Path patterns match the decoded path
     * like Spring MVC does, so an encoded {@code /%61pi/...} is still the API and stays protected.
     */
    private static RequestMatcher frontendRequests() {
        PathPatternRequestMatcher.Builder paths = PathPatternRequestMatcher.withDefaults();
        RequestMatcher reads = new OrRequestMatcher(
                paths.matcher(HttpMethod.GET, "/**"), paths.matcher(HttpMethod.HEAD, "/**"));
        RequestMatcher backend = new OrRequestMatcher(paths.matcher("/api/**"), paths.matcher("/actuator/**"));
        return new AndRequestMatcher(reads, new NegatedRequestMatcher(backend));
    }

    /**
     * Readable by the SPA (not HttpOnly) by design: the double-submit pattern needs it. It follows
     * the session cookie's {@code Secure} flag, so one switch serves both; only the LAN demo over
     * plain HTTP turns it off (ADR-0029).
     */
    @Bean
    CsrfTokenRepository csrfTokenRepository(
            @Value("${server.servlet.session.cookie.secure:true}") boolean secureCookies) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie.secure(secureCookies).sameSite("Lax"));
        return repository;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /**
     * bcrypt today; the {@code {id}} prefix lets a future encoder (e.g. Argon2) coexist. A stored
     * hash without a known prefix never matches, instead of failing the login with a 500.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        DelegatingPasswordEncoder encoder =
                new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", new BCryptPasswordEncoder()));
        encoder.setDefaultPasswordEncoderForMatches(new NeverMatchingPasswordEncoder());
        return encoder;
    }

    private static final class NeverMatchingPasswordEncoder implements PasswordEncoder {

        @Override
        public String encode(CharSequence rawPassword) {
            throw new UnsupportedOperationException("Only used to reject unknown hash formats");
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return false;
        }
    }
}
