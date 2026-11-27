package ar.gestorpenal.mail;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for the test email. */
@RestControllerAdvice(assignableTypes = MailController.class)
class MailProblemHandler {

    @ExceptionHandler(MailTestRateLimitedException.class)
    ProblemDetail rateLimited(MailTestRateLimitedException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, exception.getMessage());
        problem.setType(URI.create("/problems/mail-test-rate-limited"));
        problem.setTitle("Too many requests");
        return problem;
    }
}
