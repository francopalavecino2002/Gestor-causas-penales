package ar.gestorpenal.security;

import ar.gestorpenal.user.InvalidPasswordException;
import ar.gestorpenal.user.WrongPasswordException;
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

    @ExceptionHandler(InvalidSecondFactorException.class)
    ProblemDetail invalidSecondFactor() {
        return problem(HttpStatus.UNAUTHORIZED, "invalid-second-factor", "Invalid verification code",
                "The verification code is not valid.");
    }

    @ExceptionHandler(SecondFactorExpiredException.class)
    ProblemDetail secondFactorExpired() {
        return problem(HttpStatus.UNAUTHORIZED, "second-factor-expired", "Login expired",
                "There is no pending login or it expired. Log in again.");
    }

    @ExceptionHandler({TwoFactorConfirmationException.class, WrongPasswordException.class})
    ProblemDetail invalidConfirmation() {
        return problem(HttpStatus.UNPROCESSABLE_CONTENT, "invalid-confirmation", "Not confirmed",
                "The code or password is not valid.");
    }

    @ExceptionHandler(TwoFactorStateException.class)
    ProblemDetail twoFactorState(TwoFactorStateException exception) {
        return problem(HttpStatus.CONFLICT, "two-factor-state", "Two-factor state conflict", exception.getMessage());
    }

    @ExceptionHandler(InvalidPasswordException.class)
    ProblemDetail invalidPassword(InvalidPasswordException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-password", "Password not accepted", exception.getMessage());
    }

    /** More specific than {@link AccessDeniedException}, so it wins over {@link #accessDenied()}. */
    @ExceptionHandler(PasswordChangeRequiredException.class)
    ProblemDetail passwordChangeRequired(PasswordChangeRequiredException exception) {
        return problem(HttpStatus.FORBIDDEN, "password-change-required", "Password change required",
                exception.getMessage());
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
