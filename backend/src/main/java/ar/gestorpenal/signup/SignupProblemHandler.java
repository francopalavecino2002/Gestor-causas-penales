package ar.gestorpenal.signup;

import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for the sign-up. */
@RestControllerAdvice(assignableTypes = SignupController.class)
class SignupProblemHandler {

    @ExceptionHandler(SignupDisabledException.class)
    ProblemDetail disabled() {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", "There is nothing here.");
    }

    @ExceptionHandler(InvalidSignupException.class)
    ProblemDetail invalid(InvalidSignupException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-signup", "Sign-up not valid", exception.getMessage());
    }

    @ExceptionHandler(SignupThrottledException.class)
    ResponseEntity<ProblemDetail> throttled(SignupThrottledException exception) {
        ProblemDetail body = problem(HttpStatus.TOO_MANY_REQUESTS, "signup-throttled", "Too many sign-ups",
                "Wait before signing up again.");
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
