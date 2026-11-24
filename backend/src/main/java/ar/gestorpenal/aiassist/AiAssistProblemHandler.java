package ar.gestorpenal.aiassist;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for the AI assistance. */
@RestControllerAdvice(assignableTypes = AiAssistController.class)
class AiAssistProblemHandler {

    @ExceptionHandler(AiAssistUnavailableException.class)
    ProblemDetail unavailable(AiAssistUnavailableException exception) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "ai-assist-unavailable", "Not available", exception.getMessage());
    }

    @ExceptionHandler(AiAssistDisabledException.class)
    ProblemDetail disabled(AiAssistDisabledException exception) {
        return problem(HttpStatus.CONFLICT, "ai-assist-disabled", "Turned off", exception.getMessage());
    }

    @ExceptionHandler(AiAssistRateLimitedException.class)
    ProblemDetail rateLimited(AiAssistRateLimitedException exception) {
        return problem(HttpStatus.TOO_MANY_REQUESTS, "ai-assist-rate-limited", "Too many requests", exception.getMessage());
    }

    @ExceptionHandler(AiCaseNotFoundException.class)
    ProblemDetail notFound(AiCaseNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(AiProviderException.class)
    ProblemDetail provider(AiProviderException exception) {
        return exception.busy()
                ? problem(HttpStatus.SERVICE_UNAVAILABLE, "ai-provider-busy", "Provider busy", exception.getMessage())
                : problem(HttpStatus.BAD_GATEWAY, "ai-provider-failed", "Provider failed", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
