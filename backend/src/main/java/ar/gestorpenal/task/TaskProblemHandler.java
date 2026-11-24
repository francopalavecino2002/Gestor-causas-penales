package ar.gestorpenal.task;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for task errors. */
@RestControllerAdvice(assignableTypes = TaskController.class)
class TaskProblemHandler {

    @ExceptionHandler(TaskNotFoundException.class)
    ProblemDetail notFound(TaskNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidTaskDataException.class)
    ProblemDetail invalid(InvalidTaskDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-task-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(ArchivedTaskRecordException.class)
    ProblemDetail archived(ArchivedTaskRecordException exception) {
        return problem(HttpStatus.CONFLICT, "archived-record", "Archived", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
