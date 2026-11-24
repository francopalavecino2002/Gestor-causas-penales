package ar.gestorpenal.jurisdiction;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * problem+json bodies (RFC 9457) for practice area errors. Not tied to a controller: the module
 * guard fires from the case, hearing and measure endpoints alike.
 */
@RestControllerAdvice
class PracticeAreaProblemHandler {

    @ExceptionHandler(PracticeAreaNotFoundException.class)
    ProblemDetail notFound(PracticeAreaNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "practice-area-not-found", "Practice area not found", exception.getMessage());
    }

    @ExceptionHandler(PracticeAreaNotEnabledException.class)
    ProblemDetail notEnabled(PracticeAreaNotEnabledException exception) {
        return problem(HttpStatus.CONFLICT, "practice-area-not-enabled", "Practice area not enabled", exception.getMessage());
    }

    @ExceptionHandler(ModuleNotEnabledException.class)
    ProblemDetail moduleNotEnabled(ModuleNotEnabledException exception) {
        return problem(HttpStatus.CONFLICT, "module-not-enabled", "Module not enabled", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
