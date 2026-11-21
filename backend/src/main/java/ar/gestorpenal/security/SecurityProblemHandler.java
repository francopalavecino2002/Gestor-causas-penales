package ar.gestorpenal.security;

import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * problem+json bodies (RFC 9457) for authentication errors, both from controllers and from the
 * security filters, which delegate here (see {@link SecurityConfig}). Details are generic on purpose:
 * they never say whether the firm or the account exists.
 */
@RestControllerAdvice
class SecurityProblemHandler {

    @ExceptionHandler(BadCredentialsException.class)
    ProblemDetail invalidCredentials() {
        return problem(HttpStatus.UNAUTHORIZED, "invalid-credentials", "Invalid credentials",
                "The firm, email or password is not valid.");
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail authenticationRequired() {
        return problem(HttpStatus.UNAUTHORIZED, "authentication-required", "Authentication required",
                "Log in to access this resource.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail accessDenied() {
        return problem(HttpStatus.FORBIDDEN, "access-denied", "Access denied",
                "The request is not allowed. If it changes data, send a valid CSRF token.");
    }

    @ExceptionHandler(LoginThrottledException.class)
    ResponseEntity<ProblemDetail> loginThrottled(LoginThrottledException exception) {
        ProblemDetail body = problem(HttpStatus.TOO_MANY_REQUESTS, "login-throttled", "Too many failed logins",
                "Wait before trying to log in again.");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(exception.retryAfterSeconds()))
                .body(body);
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
