package ar.gestorpenal.deadline;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for deadline, rule and suspension errors. */
@RestControllerAdvice(assignableTypes = {
    DeadlineController.class, DeadlineRuleController.class, DeadlineSuspensionController.class
})
class DeadlineProblemHandler {

    @ExceptionHandler(DeadlineNotFoundException.class)
    ProblemDetail notFound(DeadlineNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidDeadlineDataException.class)
    ProblemDetail invalid(InvalidDeadlineDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-deadline-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(ArchivedDeadlineRecordException.class)
    ProblemDetail archived(ArchivedDeadlineRecordException exception) {
        return problem(HttpStatus.CONFLICT, "archived-record", "Archived", exception.getMessage());
    }

    @ExceptionHandler(DeadlineStateException.class)
    ProblemDetail state(DeadlineStateException exception) {
        return problem(HttpStatus.CONFLICT, "invalid-deadline-state", "Not allowed in this state", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
